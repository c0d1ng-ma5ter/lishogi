package views.html.analyse

import play.api.i18n.Lang

import lila.app.templating.Environment._
import lila.i18n.{ I18nKeys => trans }

private object jsI18n {

  def apply()(implicit lang: Lang) = i18nJsObject(i18nKeys)

  private val i18nKeys = List(
    trans.black,
    trans.white,
    trans.sente,
    trans.gote,
    trans.shitate,
    trans.uwate,
    trans.flipBoard,
    trans.gameAborted,
    trans.checkmate,
    trans.xResigned,
    trans.stalemate,
    trans.royalsLost,
    trans.bareKing,
    trans.check,
    trans.repetition,
    trans.perpetualCheck,
    trans.xLeftTheGame,
    trans.xDidntMove,
    trans.draw,
    trans.impasse,
    trans.timeOut,
    trans.playingRightNow,
    trans.xIsVictorious,
    trans.cheatDetected,
    trans.variantEnding,
    trans.analysis,
    trans.boardEditor,
    trans.continueFromHere,
    trans.playWithTheMachine,
    trans.playWithAFriend,
    trans.openingExplorer,
    trans.inaccuracies,
    trans.mistakes,
    trans.blunders,
    trans.averageCentipawnLoss,
    trans.goodMove,
    trans.viewTheSolution,
    trans.youNeedAnAccountToDoThat,
    // study
    trans.postGameStudy,
    trans.standardStudy,
    trans.postGameStudyExplanation,
    trans.studyWith,
    trans.optional,
    trans.postGameStudiesOfGame,
    trans.study.createStudy,
    trans.study.searchByUsername,
    // ceval (also uses gameOver)
    trans.depthX,
    trans.usingServerAnalysis,
    trans.loadingEngine,
    trans.cloudAnalysis,
    trans.goDeeper,
    trans.showThreat,
    trans.gameOver,
    trans.inLocalBrowser,
    trans.toggleLocalEvaluation,
    trans.variantNotSupported,
    // action menu
    trans.menu,
    trans.toStudy,
    trans.inlineNotation,
    trans.computerAnalysis,
    trans.enable,
    trans.bestMoveArrow,
    trans.evaluationGauge,
    trans.infiniteAnalysis,
    trans.removesTheDepthLimit,
    trans.multipleLines,
    trans.cpus,
    trans.memory,
    trans.delete,
    trans.deleteThisImportedGame,
    trans.replayMode,
    trans.slow,
    trans.fast,
    trans.realtimeReplay,
    trans.byCPL,
    // context menu
    trans.promoteVariation,
    trans.makeMainLine,
    trans.deleteFromHere,
    trans.forceVariation,
    // practice (also uses checkmate, draw)
    trans.practiceWithComputer,
    trans.goodMove,
    trans.inaccuracy,
    trans.mistake,
    trans.blunder,
    trans.anotherWasX,
    trans.bestWasX,
    trans.youBrowsedAway,
    trans.resumePractice,
    trans.xWinsGame,
    trans.theGameIsADraw,
    trans.yourTurn,
    trans.computerThinking,
    trans.seeBestMove,
    trans.hideBestMove,
    trans.getAHint,
    trans.evaluatingYourMove,
    // retrospect (also uses youBrowsedAway, bestWasX, evaluatingYourMove)
    trans.learnFromYourMistakes,
    trans.learnFromThisMistake,
    trans.skipThisMove,
    trans.next,
    trans.xWasPlayed,
    trans.findBetterMoveForX,
    trans.resumeLearning,
    trans.youCanDoBetter,
    trans.tryAnotherMoveForX,
    trans.solution,
    trans.waitingForAnalysis,
    trans.noMistakesFoundForX,
    trans.doneReviewingXMistakes,
    trans.doItAgain,
    trans.reviewXMistakes,
    // explorer (also uses gameOver, checkmate, stalemate, draw, variantEnding)
    // trans.openingExplorerAndTablebase,
    // trans.openingExplorer,
    // trans.xOpeningExplorer,
    // trans.move,
    // trans.games,
    // trans.variantLoss,
    // trans.variantWin,
    // trans.insufficientMaterial,
    // trans.capture,
    // trans.pawnMove,
    // trans.close,
    // trans.winning,
    // trans.unknown,
    // trans.losing,
    // trans.drawn,
    // trans.timeControl,
    // trans.averageElo,
    // trans.database,
    // trans.recentGames,
    // trans.topGames,
    // trans.averageRatingX,
    // trans.noGameFound,
    // trans.maybeIncludeMoreGamesFromThePreferencesMenu,
    // trans.allSet,
    // advantage and movetime charts
    trans.advantage,
    trans.nbSeconds,
    trans.opening,
    trans.middlegame,
    trans.endgame
  ).map(_.key)
}
