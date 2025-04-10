package lila.playban

import scala.concurrent.duration._

import org.joda.time.DateTime
import reactivemongo.api.bson._

import shogi.Centis
import shogi.Color
import shogi.Status

import lila.common.Bus
import lila.common.Iso
import lila.common.Uptime
import lila.db.dsl._
import lila.game.Game
import lila.game.Player
import lila.game.Pov
import lila.game.Source
import lila.msg.MsgApi
import lila.msg.MsgPreset
import lila.user.User
import lila.user.UserRepo

final class PlaybanApi(
    coll: Coll,
    sandbag: SandbagWatch,
    feedback: PlaybanFeedback,
    userRepo: UserRepo,
    cacheApi: lila.memo.CacheApi,
    messenger: MsgApi,
)(implicit ec: scala.concurrent.ExecutionContext) {

  import reactivemongo.api.bson.Macros
  implicit private val OutcomeBSONHandler: BSONHandler[Outcome] = tryHandler[Outcome](
    { case BSONInteger(v) => Outcome(v) toTry s"No such playban outcome: $v" },
    x => BSONInteger(x.id),
  )
  implicit private val RageSitBSONHandler: BSONHandler[RageSit] = intIsoHandler(
    Iso.int[RageSit](RageSit.apply, _.counter),
  )
  implicit private val BanBSONHandler: BSONDocumentHandler[TempBan] = Macros.handler[TempBan]
  implicit private val UserRecordBSONHandler: BSONDocumentHandler[UserRecord] =
    Macros.handler[UserRecord]

  private case class Blame(player: Player, outcome: Outcome)

  private val blameableSources: Set[Source] = Set(Source.Lobby, Source.Tournament)

  private def blameable(game: Game): Fu[Boolean] =
    (game.source.exists(blameableSources.contains) && game.hasClock) ?? {
      if (game.rated) fuTrue
      else !userRepo.containsEngine(game.userIds)
    }

  private def IfBlameable[A: alleycats.Zero](game: Game)(f: => Fu[A]): Fu[A] =
    Uptime.startedSinceMinutes(10) ?? {
      blameable(game) flatMap { _ ?? f }
    }

  def abort(pov: Pov, isOnGame: Set[Color]): Funit =
    IfBlameable(pov.game) {
      pov.player.userId.ifTrue(isOnGame(pov.opponent.color)) ?? { userId =>
        save(Outcome.Abort, userId, RageSit.Reset, pov.game.source) >>- feedback.abort(pov)
      }
    }

  def noStart(pov: Pov): Funit =
    IfBlameable(pov.game) {
      pov.player.userId ?? { userId =>
        save(Outcome.NoPlay, userId, RageSit.Reset, pov.game.source) >>- feedback.noStart(pov)
      }
    }

  def rageQuit(game: Game, quitterColor: Color): Funit =
    sandbag(game, quitterColor) >> IfBlameable(game) {
      game.player(quitterColor).userId ?? { userId =>
        save(Outcome.RageQuit, userId, RageSit.imbalanceInc(game, quitterColor), game.source) >>-
          feedback.rageQuit(Pov(game, quitterColor))
      }
    }

  def flag(game: Game, flaggerColor: Color): Funit = {

    def unreasonableTime =
      game.clock map { c =>
        (c.estimateTotalSeconds / 12) atLeast 15 atMost (3 * 60)
      }

    // flagged after waiting a long time
    def sitting: Option[Funit] =
      for {
        userId <- game.player(flaggerColor).userId
        seconds = nowSeconds - game.movedAt.getSeconds
        if unreasonableTime.exists(seconds >= _)
      } yield save(
        Outcome.Sitting,
        userId,
        RageSit.imbalanceInc(game, flaggerColor),
        game.source,
      ) >>-
        feedback.sitting(Pov(game, flaggerColor)) >>
        propagateSitting(game, userId)

    // flagged after waiting a short time;
    // but the previous move used a long time.
    // assumes game was already checked for sitting
    def sitMoving: Option[Funit] =
      game.player(flaggerColor).userId.ifTrue {
        ~(for {
          movetimes   <- game moveTimes flaggerColor
          lastUsiTime <- movetimes.lastOption
          limit       <- unreasonableTime
        } yield lastUsiTime.toSeconds >= limit)
      } map { userId =>
        save(Outcome.SitMoving, userId, RageSit.imbalanceInc(game, flaggerColor), game.source) >>-
          feedback.sitting(Pov(game, flaggerColor)) >>
          propagateSitting(game, userId)
      }

    sandbag(game, flaggerColor) flatMap { isSandbag =>
      IfBlameable(game) {
        sitting orElse
          sitMoving getOrElse
          goodOrSandbag(game, flaggerColor, isSandbag)
      }
    }
  }

  private def propagateSitting(game: Game, userId: User.ID): Funit =
    rageSitCache get userId map { rageSit =>
      if (rageSit.isBad) Bus.publish(SittingDetected(game, userId), "playban")
    }

  def other(game: Game, status: Status.type => Status, winner: Option[Color]): Funit =
    winner.?? { w =>
      sandbag(game, !w)
    } flatMap { isSandbag =>
      IfBlameable(game) {
        ~(for {
          w <- winner
          loser = game.player(!w)
          loserId <- loser.userId
        } yield {
          if (Status.NoStart is status)
            save(Outcome.NoPlay, loserId, RageSit.Reset, game.source) >>- feedback.noStart(
              Pov(game, !w),
            )
          else
            game.clock
              .filter { c =>
                val cc = c.currentClockFor(loser.color)
                cc.time < Centis(1000) &&
                cc.periods == c.periodsTotal &&
                game.turnOf(loser) &&
                Status.Resign.is(status)
              }
              .map { c =>
                (c.estimateTotalSeconds / 10) atLeast 30 atMost (3 * 60)
              }
              .exists(_ < nowSeconds - game.movedAt.getSeconds)
              .option {
                save(
                  Outcome.SitResign,
                  loserId,
                  RageSit.imbalanceInc(game, loser.color),
                  game.source,
                ) >>-
                  feedback.sitting(Pov(game, loser.color)) >>
                  propagateSitting(game, loserId)
              }
              .getOrElse {
                goodOrSandbag(game, !w, isSandbag)
              }
        })
      }
    }

  private def goodOrSandbag(game: Game, loserColor: Color, isSandbag: Boolean): Funit =
    game.player(loserColor).userId ?? { userId =>
      if (isSandbag) feedback.sandbag(Pov(game, loserColor))
      val rageSitDelta =
        if (isSandbag) RageSit.Reset
        else RageSit.redeem(game)
      save(if (isSandbag) Outcome.Sandbag else Outcome.Good, userId, rageSitDelta, game.source)
    }

  // memorize users without any ban to save DB reads
  private val cleanUserIds = new lila.memo.ExpireSetMemo(30 minutes)

  def currentBan(userId: User.ID): Fu[Option[TempBan]] =
    !cleanUserIds.get(userId) ?? {
      coll
        .find(
          $doc("_id" -> userId, "b.0" $exists true),
          $doc("_id" -> false, "b" -> $doc("$slice" -> -1)).some,
        )
        .one[Bdoc]
        .dmap {
          _.flatMap(_.getAsOpt[List[TempBan]]("b")).??(_.find(_.inEffect))
        } addEffect { ban =>
        if (ban.isEmpty) cleanUserIds put userId
      }
    }

  def hasCurrentBan(userId: User.ID): Fu[Boolean] = currentBan(userId).map(_.isDefined)

  def completionRate(userId: User.ID): Fu[Option[Double]] =
    coll.primitiveOne[Vector[Outcome]]($id(userId), "o").map(~_) map { outcomes =>
      outcomes.collect {
        case Outcome.RageQuit | Outcome.Sitting | Outcome.NoPlay | Outcome.Abort => false
        case Outcome.Good                                                        => true
      } match {
        case c if c.sizeIs >= 5 => Some(c.count(identity).toDouble / c.size)
        case _                  => none
      }
    }

  def bans(userIds: List[User.ID]): Fu[Map[User.ID, Int]] =
    coll
      .find(
        $inIds(userIds),
        $doc("b" -> true).some,
      )
      .cursor[Bdoc]()
      .list()
      .map {
        _.flatMap { obj =>
          obj.getAsOpt[User.ID]("_id") flatMap { id =>
            obj.getAsOpt[Barr]("b") map { id -> _.size }
          }
        }.toMap
      }

  def getRageSit(userId: User.ID) = rageSitCache get userId

  private val rageSitCache = cacheApi[User.ID, RageSit](512, "playban.ragesit") {
    _.expireAfterAccess(20 minutes)
      .buildAsyncFuture { userId =>
        coll
          .primitiveOne[RageSit]($doc("_id" -> userId, "c" $exists true), "c")
          .map(_ | RageSit.empty)
      }
  }

  private def save(
      outcome: Outcome,
      userId: User.ID,
      rsUpdate: RageSit.Update,
      source: Option[Source],
  ): Funit = {
    lila.mon.playban.outcome(outcome.key).increment()
    coll
      .findAndUpdateEasy[UserRecord](
        selector = $id(userId),
        update = $doc(
          $push("o" -> $doc("$each" -> List(outcome), "$slice" -> -30)) ++ {
            rsUpdate match {
              case RageSit.Reset            => $min("c" -> 0)
              case RageSit.Inc(v) if v != 0 => $inc("c" -> v)
              case _                        => $empty
            }
          },
        ),
        fetchNewObject = true,
        upsert = true,
      ) orFail s"can't find newly created record for user $userId" flatMap { record =>
      (outcome != Outcome.Good) ?? {
        userRepo.createdAtById(userId).flatMap { _ ?? { legiferate(record, _, source) } }
      } >>
        registerRageSit(record, rsUpdate)
    }
  }.void logFailure lila.log("playban")

  private def registerRageSit(record: UserRecord, update: RageSit.Update): Funit =
    update match {
      case RageSit.Inc(delta) =>
        rageSitCache.put(record.userId, fuccess(record.rageSit))
        (delta < 0) ?? {
          if (record.rageSit.isTerrible) funit
          else if (record.rageSit.isVeryBad)
            userRepo byId record.userId flatMap {
              _ ?? { u =>
                lila
                  .log("ragesit")
                  .info(s"https://lishogi.org/@/${u.username} ${record.rageSit.counterView}")
                Bus.publish(
                  lila.hub.actorApi.mod.AutoWarning(u.id, MsgPreset.sittingAuto.name),
                  "autoWarning",
                )
                messenger.postPreset(u, MsgPreset.sittingAuto).void
              }
            }
          else funit
        }
      case _ => funit
    }

  private def legiferate(
      record: UserRecord,
      accCreatedAt: DateTime,
      source: Option[Source],
  ): Funit =
    record.bannable(accCreatedAt) ?? { ban =>
      (!record.banInEffect) ?? {
        lila.mon.playban.ban.count.increment()
        lila.mon.playban.ban.mins.record(ban.mins)
        Bus.publish(
          lila.hub.actorApi.playban
            .Playban(record.userId, ban.mins, inTournament = source has Source.Tournament),
          "playban",
        )
        coll.update
          .one(
            $id(record.userId),
            $unset("o") ++
              $push(
                "b" -> $doc(
                  "$each"  -> List(ban),
                  "$slice" -> -30,
                ),
              ),
          )
          .void >>- cleanUserIds.remove(record.userId)
      }
    }
}
