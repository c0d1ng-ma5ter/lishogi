import { StoredBooleanProp, StoredJsonProp, storedJsonProp, storedProp } from 'common/storage';
import {
  Arrangement,
  NewArrangement,
  NewArrangementSettings,
  Pages,
  PlayerInfo,
  Standing,
  TeamInfo,
  TournamentData,
  TournamentOpts,
} from './interfaces';
import { maxPerPage, myPage, players } from './pagination';
import makeSocket, { TournamentSocket } from './socket';
import * as sound from './sound';
import * as tour from './tournament';
import xhr from './xhr';

interface CtrlTeamInfo {
  requested?: string;
  loaded?: TeamInfo;
}

export default class TournamentController {
  opts: TournamentOpts;
  data: TournamentData;
  trans: Trans;
  socket: TournamentSocket;
  page: number;
  pages: Pages = {};
  lastPageDisplayed: number | undefined;
  focusOnMe: boolean;
  joinSpinner: boolean = false;
  playerInfo: PlayerInfo = {};
  teamInfo: CtrlTeamInfo = {};
  arrangement: Arrangement | undefined;
  utc: StoredBooleanProp = storedProp('arrangement.utc', false);
  playerManagement: boolean = false;
  newArrangement: NewArrangement | undefined;
  newArrangementSettings: StoredJsonProp<NewArrangementSettings>;
  shadedCandidates: string[] = [];
  highlightArrs: string[] = [];
  disableClicks: boolean = true;
  searching: boolean = false;
  joinWithTeamSelector: boolean = false;
  redraw: () => void;
  nbWatchers: number = 0;

  private watchingGameId: string;
  private lastStorage = window.lishogi.storage.make('last-redirect');

  constructor(opts: TournamentOpts, redraw: () => void) {
    this.opts = opts;
    this.data = opts.data;
    this.redraw = redraw;
    this.trans = window.lishogi.trans(opts.i18n);
    this.socket = makeSocket(opts.socketSend, this);
    this.page = this.data.standing.page || 1;
    this.focusOnMe = tour.isIn(this);
    setTimeout(() => (this.disableClicks = false), 1500);
    this.loadPage(this.data.standing);
    this.scrollToMe();
    sound.end(this.data);
    sound.countDown(this.data);
    this.recountTeams();
    this.redirectToMyGame();

    this.newArrangementSettings = storedJsonProp('arrangement.newArrangementSettings' + this.data.id, () => {
      return { points: { w: 3, d: 2, l: 1 } };
    });

    const hash = window.location.hash,
      userIds = hash.slice(1).split(';');
    if (
      userIds.length === 2 &&
      userIds[0] !== userIds[1] &&
      this.data.system !== 'arena' &&
      userIds.every(u => this.data.standing.players.some(p => p.id === u))
    )
      this.arrangement = this.findOrCreateArrangement(userIds);
    else if (hash.length === 8) this.arrangement = this.data.standing.arrangements.find(a => a.id === hash);

    window.lishogi.pubsub.on('socket.in.crowd', data => {
      this.nbWatchers = data.nb;
    });
    if (this.data.featured) this.startWatching(this.data.featured.id);
  }

  askReload = (): void => {
    if (this.joinSpinner) xhr.reloadNow(this);
    else xhr.reloadSoon(this);
  };

  reload = (data: TournamentData): void => {
    // we joined a private tournament! Reload the page to load the chat
    if (!this.data.me && data.me && this.data['private']) window.lishogi.reload();

    this.data = { ...this.data, ...data };
    this.data.me = data.me;
    this.data.isCandidate = data.isCandidate;
    this.data.isDenied = data.isDenied;
    this.data.isClosed = data.isClosed;
    this.data.candidatesOnly = data.candidatesOnly;
    this.data.candidatesFull = data.candidatesFull;
    if (data.playerInfo && data.playerInfo.player.id === this.playerInfo.id) this.playerInfo.data = data.playerInfo;

    this.loadPage(data.standing);
    if (this.focusOnMe) this.scrollToMe();
    if (data.featured) this.startWatching(data.featured.id);
    sound.end(data);
    sound.countDown(data);
    this.shadedCandidates = [];
    this.joinSpinner = false;
    this.recountTeams();
    this.redirectToMyGame();
  };

  isRobin = () => this.data.system === 'robin';
  isOrganized = () => this.data.system === 'organized';
  isArena = () => this.data.system === 'arena';

  isCreator = () => this.data.createdBy === this.opts.userId;

  myGameId = () => {
    return this.data.me?.gameId;
  };

  private recountTeams() {
    if (this.data.teamBattle)
      this.data.teamBattle.hasMoreThanTenTeams = Object.keys(this.data.teamBattle.teams).length > 10;
  }

  private redirectToMyGame() {
    const gameId = this.myGameId();
    if (gameId) this.redirectFirst(gameId);
  }

  redirectFirst = (gameId: string, rightNow?: boolean) => {
    const delay = rightNow || document.hasFocus() ? 10 : 1000 + Math.random() * 500;
    setTimeout(() => {
      if (this.lastStorage.get() !== gameId) {
        this.lastStorage.set(gameId);
        window.lishogi.redirect('/' + gameId);
      }
    }, delay);
  };

  loadPage = (data: Standing) => {
    if (this.isArena()) {
      if (!data.failed || !this.pages[data.page]) this.pages[data.page] = data.players;
    } else if (this.isOrganized()) {
      console.log('p', data.players);
      for (let i = 1; i <= Math.ceil(data.players.length / maxPerPage); i++)
        this.pages[i] = data.players.slice((i - 1) * maxPerPage, i * maxPerPage);
    }
  };

  setPage = (page: number) => {
    this.page = page;
    if (this.isArena()) xhr.loadPage(this, page);
  };

  jumpToPageOf = (name: string) => {
    const userId = name.toLowerCase();
    if (this.isArena()) {
      xhr.loadPageOf(this, userId).then(data => {
        this.loadPage(data);
        this.page = data.page;
        this.searching = false;
        this.focusOnMe = false;
        this.pages[this.page].filter(p => p.name.toLowerCase() == userId).forEach(this.showPlayerInfo);
      });
    } else {
      const index = this.data.standing.players.findIndex(p => p.id === userId);
      if (index !== -1) this.page = Math.floor(index / maxPerPage) + 1;
      this.searching = false;
      this.focusOnMe = false;
    }
    this.redraw();
  };

  userSetPage = (page: number) => {
    this.focusOnMe = false;
    this.setPage(page);
  };

  userNextPage = () => this.userSetPage(this.page + 1);
  userPrevPage = () => this.userSetPage(this.page - 1);
  userLastPage = () => this.userSetPage(players(this).nbPages);

  withdraw = () => {
    xhr.withdraw(this);
    this.joinSpinner = true;
    this.focusOnMe = false;
  };

  join = (password?: string, team?: string) => {
    this.joinWithTeamSelector = false;
    if (!this.data.verdicts.accepted)
      return this.data.verdicts.list.forEach(v => {
        if (v.verdict !== 'ok') alert(v.verdict);
      });
    if (this.data.teamBattle && !team && !this.data.me) {
      this.joinWithTeamSelector = true;
    } else {
      xhr.join(this, password, team);
      this.joinSpinner = true;
      this.focusOnMe = true;
    }
  };

  processCandidate(userId: string, accept: boolean) {
    this.shadedCandidates.push(userId);
    this.socket.send('process-candidate', { u: userId, v: accept });
    this.redraw();
  }

  playerKick(userId: string) {
    this.socket.send('player-kick', { v: userId });
    this.redraw();
  }

  private startWatching(id: string) {
    if (id !== this.watchingGameId) {
      this.watchingGameId = id;
      setTimeout(() => this.socket.send('startWatching', id), 1000);
    }
  }

  scrollToMe = () => {
    if (this.isArena() || this.isOrganized()) {
      const page = myPage(this);
      if (page && page !== this.page) this.setPage(page);
    }
  };

  toggleFocusOnMe = () => {
    if (!this.data.me) return;
    this.focusOnMe = !this.focusOnMe;
    if (this.focusOnMe) this.scrollToMe();
  };

  findArrangement = (users: string[]): Arrangement | undefined => {
    return this.data.standing.arrangements.find(a => users.includes(a.user1.id) && users.includes(a.user2.id));
  };

  findOrCreateArrangement = (users: string[]): Arrangement => {
    const existing = this.findArrangement(users);
    if (existing) return existing;
    else {
      const arr = {
        id: undefined,
        user1: {
          id: users[0],
        },
        user2: {
          id: users[1],
        },
      };
      // this.data.standing.arrangements.push(arr);
      return arr;
    }
  };

  showArrangement = (arrangement: Arrangement | undefined) => {
    console.log('showArrangement', arrangement);
    this.arrangement = arrangement;
    if (arrangement) window.history.replaceState(null, '', '#' + arrangement.user1.id + ';' + arrangement.user2.id);
    else history.replaceState(null, '', window.location.pathname + window.location.search);
    this.redraw();
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  arrangementMatch = (arrangement: Arrangement, yes: boolean) => {
    this.socket.send('arrangement-match', {
      id: arrangement.id,
      users: arrangement.user1.id + ';' + arrangement.user2.id,
      y: yes,
    });
  };

  arrangementTime = (arrangement: Arrangement, date: Date | undefined) => {
    console.log('arrangementTime', arrangement, date, date?.getTime());
    const data = {
      id: arrangement.id,
      users: arrangement.user1.id + ';' + arrangement.user2.id,
    };
    if (date) data['t'] = date.getTime();
    this.socket.send('arrangement-time', data);
  };

  showOrganizerArrangement() {
    this.newArrangement = this.newArrangementSettings();
  }

  showPlayerInfo = player => {
    if (this.data.secondsToStart) return;
    const userId = player.name.toLowerCase();
    this.teamInfo.requested = undefined;
    this.playerInfo = {
      id: this.playerInfo.id === userId ? null : userId,
      player: player,
      data: null,
    };
    if (this.playerInfo.id) xhr.playerInfo(this, this.playerInfo.id);
  };

  setPlayerInfoData = data => {
    if (data.player.id === this.playerInfo.id) this.playerInfo.data = data;
  };

  showTeamInfo = (teamId: string) => {
    this.playerInfo.id = undefined;
    this.teamInfo = {
      requested: this.teamInfo.requested === teamId ? undefined : teamId,
      loaded: undefined,
    };
    if (this.teamInfo.requested) xhr.teamInfo(this, this.teamInfo.requested);
  };

  setTeamInfo = (teamInfo: TeamInfo) => {
    if (teamInfo.id === this.teamInfo.requested) this.teamInfo.loaded = teamInfo;
  };

  toggleSearch = () => {
    this.searching = !this.searching;
  };
}
