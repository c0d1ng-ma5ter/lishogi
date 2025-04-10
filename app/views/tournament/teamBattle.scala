package views.html
package tournament

import controllers.routes
import play.api.data.Form

import lila.api.Context
import lila.app.templating.Environment._
import lila.app.ui.ScalatagsTemplate._
import lila.tournament.TeamBattle
import lila.tournament.Tournament

object teamBattle {

  def edit(tour: Tournament, form: Form[_])(implicit ctx: Context) =
    views.html.base.layout(
      title = tour.trans,
      moreCss = cssTag("tournament.form"),
      moreJs = jsTag("tournament.team-battle-form"),
    )(
      main(cls := "page-small")(
        div(cls := "tour__form box box-pad")(
          h1(tour.trans),
          standardFlash(),
          if (tour.isFinished) p("This tournament is over, and the teams can no longer be updated.")
          else p("List the teams that will compete in this battle."),
          postForm(cls := "form3", action := routes.Tournament.teamBattleUpdate(tour.id))(
            form3.group(
              form("teams"),
              raw("One team per line. Use the auto-completion."),
              help = frag(
                "You can copy-paste this list from a tournament to another!",
                br,
                "You can't remove a team if a player has already joined the tournament with it",
              ).some,
            )(
              form3.textarea(_)(rows := 10, tour.isFinished.option(disabled)),
            ),
            form3.group(
              form("nbLeaders"),
              raw("Number of leaders per team. The sum of their score is the score of the team."),
              help = frag(
                "You really shouldn't change this value after the tournament has started!",
              ).some,
            )(
              form3.input(_)(tpe := "number"),
            ),
            form3.globalError(form),
            form3.submit("Update teams")(tour.isFinished.option(disabled)),
          ),
        ),
      ),
    )

  private val scoreTag = tag("score")

  def standing(tour: Tournament, standing: List[TeamBattle.RankedTeam])(implicit ctx: Context) =
    views.html.base.layout(
      title = tour.trans,
      moreCss = cssTag("tournament.show.team-battle"),
    )(
      main(cls := "tour__battle-standing box")(
        h1(a(href := routes.Tournament.show(tour.id))(tour.trans)),
        table(cls := "slist slist-pad tour__team-standing tour__team-standing--full")(
          tbody(
            standing.map { t =>
              tr(
                td(cls := "rank")(t.rank),
                td(cls := "team")(
                  a(href := routes.Tournament.teamInfo(tour.id, t.teamId))(teamIdToName(t.teamId)),
                ),
                td(cls := "players")(
                  fragList(
                    t.leaders.map { l =>
                      scoreTag(dataHref := routes.User.show(l.userId), cls := "user-link ulpt")(
                        l.score,
                      )
                    },
                    "+",
                  ),
                ),
                td(cls := "total")(t.score),
              )
            },
          ),
        ),
      ),
    )

  def teamInfo(tour: Tournament, team: lila.team.Team.Mini, info: TeamBattle.TeamInfo)(implicit
      ctx: Context,
  ) =
    views.html.base.layout(
      title = s"${tour.trans} - ${team.name}",
      moreCss = cssTag("tournament.show.team-battle"),
    )(
      main(cls := "box")(
        h1(
          a(href := routes.Tournament.battleTeams(tour.id))(tour.trans),
          " - ",
          a(href := routes.Team.show(team.id))(team.name),
        ),
        table(cls := "slist slist-pad")(
          tbody(
            tr(th(trans.players()), td(info.nbPlayers)),
            tr(th(trans.averageElo()), td(info.avgRating)),
            tr(th(trans.arena.averagePerformance()), td(info.avgPerf)),
            tr(th(trans.arena.averageScore()), td(info.avgScore)),
          ),
        ),
        table(cls := "slist slist-pad tour__team-info")(
          thead(
            tr(
              th(trans.rank()),
              th(trans.player()),
              th(trans.tournamentPoints()),
              th(trans.performance()),
            ),
          ),
          tbody(
            info.topPlayers.zipWithIndex.map { case (player, index) =>
              tr(
                td(index + 1),
                td(
                  (index < tour.teamBattle.??(_.nbLeaders)) option iconTag("8"),
                  userIdLink(player.userId.some),
                ),
                td(player.score),
                td(player.performance),
              )
            },
          ),
        ),
      ),
    )
}
