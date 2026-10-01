/*
 * hunt(6) C oracle: a scripted driver loop around the upstream daemon.
 *
 * Part of BSDGames Reborn, bsdgames/hunt/ports/fancy-web (MIT).
 * This file contains no upstream code. scripts/oracle/capture.mjs copies
 * huntd/*.c, huntd/*.h and hunt/otto.c from a local checkout of
 * https://github.com/vattam/BSDGames into a scratch build directory (never
 * into this repository), wraps hunt.h in an include guard and compiles this
 * file there with the Linux build's game flags (Makeconfig: RANDOM REFLECT
 * MONITOR OOZE FLY VOLCANO BOOTS OTTO). The real daemon then runs one driver
 * iteration at a time (driver.c main loop, minus the sockets) under a
 * script read from stdin, and prints its state as JSON lines.
 *
 * Script ops (one per line, '#' starts a comment):
 *   seed N                 Seed = N
 *   init                   See_over table, makemaze(), makeboots()  (driver.c init)
 *   maze                   next 23 lines are the maze (Maze + Orig_maze), no boots
 *   join NAME TEAM ST      a player connects: TEAM is a digit or '-', ST is c|s|f
 *   ensure NAME TEAM ST    join, unless NAME is already in the game
 *   bot NAME RSEED         NAME is played by otto.c; its random() is initstate(RSEED)
 *   autorejoin 0|1         dead bots re-enter cloaked (otto's quit() answer)
 *   key NAME CHARS         append keystrokes to NAME's typeahead buffer
 *   place NAME Y X F       move NAME to (Y,X) facing F (one of < > ^ v) silently
 *   put Y X C              Maze[Y][X] = C
 *   set NAME FIELD N       ammo | damage | damcap | cloak | scan
 *   step [N]               N driver iterations (default 1), dumping each (brief)
 *   quiet N                N driver iterations without dumping
 *   dump | full            print the state (brief: hashes, full: every grid)
 */
#define _GNU_SOURCE
#include "hunt.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* --- per-player virtual terminal: what the hunt client's curses screen shows */
typedef struct {
	int	cy, cx, state, a1;
	char	scr[SCREEN_HEIGHT][SCREEN_WIDTH];
} VT;

static void
vt_put(VT *vt, int c)
{
	if (vt->cy >= 0 && vt->cy < SCREEN_HEIGHT && vt->cx >= 0 && vt->cx < SCREEN_WIDTH)
		vt->scr[vt->cy][vt->cx] = c;
	if (++vt->cx >= SCREEN_WIDTH) {
		vt->cx = 0;
		if (vt->cy < SCREEN_HEIGHT - 1)
			vt->cy++;
	}
}

static void
vt_byte(VT *vt, int b)
{
	int	x;

	switch (vt->state) {
	case 1: vt->a1 = b; vt->state = 2; return;		/* MOVE y */
	case 2: vt->cy = vt->a1; vt->cx = b; vt->state = 0; return;	/* MOVE x */
	case 3: vt_put(vt, b); vt->state = 0; return;		/* ADDCH c */
	case 4: vt->state = 0; return;				/* READY n / ENDWIN c */
	}
	switch (b) {
	case MOVE: vt->state = 1; return;
	case ADDCH: vt->state = 3; return;
	case READY: case ENDWIN: vt->state = 4; return;
	case CLEAR:
		memset(vt->scr, ' ', sizeof vt->scr);
		vt->cy = vt->cx = 0;
		return;
	case CLRTOEOL:
		for (x = vt->cx; x < SCREEN_WIDTH; x++)
			if (vt->cy >= 0 && vt->cy < SCREEN_HEIGHT)
				vt->scr[vt->cy][x] = ' ';
		return;
	case REFRESH: case REDRAW: case BELL: case LAST_PLAYER:
		return;
	}
	if (b >= ' ' && b < 0177)
		vt_put(vt, b);
}

static ssize_t
vt_write(void *cookie, const char *buf, size_t size)
{
	size_t	i;

	for (i = 0; i < size; i++)
		vt_byte((VT *) cookie, (unsigned char) buf[i]);
	return size;
}

static FILE *
vt_open(VT **out)
{
	cookie_io_functions_t	io = { NULL, vt_write, NULL, NULL };
	VT			*vt = calloc(1, sizeof *vt);

	memset(vt->scr, ' ', sizeof vt->scr);
	*out = vt;
	return fopencookie(vt, "w", io);
}

/* --- the upstream daemon, as one translation unit ------------------------ */
void	faketalk(void) {}	/* driver.c calls it for the first player */

#include "extern.c"
#include "pathname.c"
#include "terminal.c"
#define message orig_message
#include "draw.c"
#undef message
#include "expl.c"
#include "makemaze.c"
#include "shots.c"
#include "execute.c"
#include "answer.c"
#define main huntd_main
#include "driver.c"
#undef main

/* --- harness state ------------------------------------------------------- */
#define NLOG	4096
static char	msglog[NLOG * 2];
static int	msglen;
static char	ottolog[NLOG];
static int	ottolen;
static char	deathlog[NLOG];
static int	deathlen;

typedef struct {
	char	name[NAMELEN];
	char	team;
	int	active;
	int	autorejoin_pending;
	char	rstate[128];
	int	num_turns;
	char	been_there[HEIGHT][WIDTH2];
	int	have_rstate;
} BOT;
static BOT	bots[MAXPL];
static int	nbots;
static int	autorejoin;
static char	joinq[MAXPL][NAMELEN];
static char	joinq_team[MAXPL];
static int	njoinq;
static VT	*vts[MAXPL];		/* indexed like Player[] */
static int	stepno;

static void
jesc(char *dst, int *len, int cap, const char *s, int n)
{
	int	i;

	for (i = 0; i < n && *len < cap - 8; i++) {
		unsigned char c = s[i];
		if (c == '"' || c == '\\') {
			dst[(*len)++] = '\\';
			dst[(*len)++] = c;
		} else if (c < ' ' || c >= 0177) {
			*len += sprintf(dst + *len, "\\u%04x", c);
		} else
			dst[(*len)++] = c;
	}
	dst[*len] = '\0';
}

static void
pstr(const char *s, int n)
{
	int	i;

	putchar('"');
	for (i = 0; i < n; i++) {
		unsigned char c = s[i];
		if (c == '"' || c == '\\')
			printf("\\%c", c);
		else if (c < ' ' || c >= 0177)
			printf("\\u%04x", c);
		else
			putchar(c);
	}
	putchar('"');
}

void
message(PLAYER *pp, const char *s)
{
	char	tmp[256];
	int	n = 0;

	jesc(tmp, &n, sizeof tmp, pp->p_ident->i_name, strlen(pp->p_ident->i_name));
	msglen += snprintf(msglog + msglen, sizeof msglog - msglen, "%s[\"%s\",\"", msglen ? "," : "", tmp);
	jesc(msglog, &msglen, sizeof msglog, s, strlen(s));
	msglen += snprintf(msglog + msglen, sizeof msglog - msglen, "\"]");
	orig_message(pp, s);
}

static PLAYER *
find(const char *name)
{
	PLAYER	*pp;

	for (pp = Player; pp < End_player; pp++)
		if (strcmp(pp->p_ident->i_name, name) == 0)
			return pp;
	return NULL;
}

static BOT *
findbot(const char *name)
{
	int	i;

	for (i = 0; i < nbots; i++)
		if (strcmp(bots[i].name, name) == 0)
			return &bots[i];
	return NULL;
}

/* answer.c's answer() minus the socket: allocate a slot, identify, stplayer() */
static void
connect_player(const char *name, char team, int status)
{
	PLAYER	*pp;
	VT	*vt;
	int	i;

	if (End_player >= &Player[MAXPL])
		return;
	pp = End_player++;
	i = pp - Player;
	pp->p_ident = get_ident(0, 0, name, team);
	pp->p_output = vt_open(&vt);
	vts[i] = vt;
	pp->p_death[0] = '\0';
	pp->p_fd = -1;
	pp->p_y = 0;
	pp->p_x = 0;
	stplayer(pp, status);
}

/* driver.c zap() moves End_player into the dead slot; keep vts[] in step */
static void
zap_player(PLAYER *pp, int i)
{
	int	last = (End_player - Player) - 1;
	char	death[MSGLEN];
	BOT	*b;

	strcpy(death, pp->p_death);
	deathlen += snprintf(deathlog + deathlen, sizeof deathlog - deathlen, "%s[\"", deathlen ? "," : "");
	jesc(deathlog, &deathlen, sizeof deathlog, pp->p_ident->i_name, strlen(pp->p_ident->i_name));
	deathlen += snprintf(deathlog + deathlen, sizeof deathlog - deathlen, "\",\"");
	jesc(deathlog, &deathlen, sizeof deathlog, death, strlen(death));
	deathlen += snprintf(deathlog + deathlen, sizeof deathlog - deathlen, "\"]");
	b = findbot(pp->p_ident->i_name);
	if (b != NULL && autorejoin) {
		strcpy(joinq[njoinq], b->name);
		joinq_team[njoinq] = b->team;
		njoinq++;
	}
	zap(pp, TRUE, i + 3);
	if (Player + i != End_player)
		vts[i] = vts[last];
}

/* otto.c hooks */
char	screen[SCREEN_HEIGHT][SCREEN_WIDTH2];
int	Otto_count;
static PLAYER	*otto_pp;

static void
otto_write(const char *buf, int n)
{
	int	k;

	ottolen += snprintf(ottolog + ottolen, sizeof ottolog - ottolen, "%s[\"", ottolen ? "," : "");
	jesc(ottolog, &ottolen, sizeof ottolog, otto_pp->p_ident->i_name, strlen(otto_pp->p_ident->i_name));
	ottolen += snprintf(ottolog + ottolen, sizeof ottolog - ottolen, "\",\"");
	jesc(ottolog, &ottolen, sizeof ottolog, buf, n);
	ottolen += snprintf(ottolog + ottolen, sizeof ottolog - ottolen, "\"]");
	if (otto_pp->p_ncount >= otto_pp->p_nchar)
		otto_pp->p_ncount = otto_pp->p_nchar = 0;
	for (k = 0; k < n; k++)
		otto_pp->p_cbuf[otto_pp->p_nchar++] = buf[k];
}

static void	run_otto(PLAYER *, BOT *);

static void
append_keys(PLAYER *pp, const char *keys)
{
	if (pp->p_ncount >= pp->p_nchar)
		pp->p_ncount = pp->p_nchar = 0;
	while (*keys)
		pp->p_cbuf[pp->p_nchar++] = *keys++;
}

/* one iteration of driver.c's main loop (driver.c:178-212 + answer) */
static void
iterate(void)
{
	PLAYER	*pp;
	int	i, k;
	BOT	*b;

	msglen = ottolen = deathlen = 0;
	msglog[0] = ottolog[0] = deathlog[0] = '\0';
	stepno++;
	for (pp = Player; pp < End_player; pp++)
		if (pp->p_ncount < pp->p_nchar) {
			execute(pp);
			pp->p_nexec++;
		}
	moveshots();
	for (pp = Player, i = 0; pp < End_player; )
		if (pp->p_death[0] != '\0')
			zap_player(pp, i);
		else
			pp++, i++;
	if (njoinq > 0) {		/* answer() takes one connection per pass */
		b = findbot(joinq[0]);
		connect_player(joinq[0], joinq_team[0], Q_CLOAK);
		for (k = 1; k < njoinq; k++) {
			strcpy(joinq[k - 1], joinq[k]);
			joinq_team[k - 1] = joinq_team[k];
		}
		njoinq--;
		(void) b;
	}
	for (pp = Player; pp < End_player; pp++) {
		pp->p_nexec = 0;
		(void) fflush(pp->p_output);
	}
	/* otto acts when all of its typeahead has been executed */
	for (pp = Player; pp < End_player; pp++) {
		b = findbot(pp->p_ident->i_name);
		if (b != NULL && pp->p_ncount >= pp->p_nchar)
			run_otto(pp, b);
	}
}

static unsigned
fnv(const char *s, int n, unsigned h)
{
	int	i;

	for (i = 0; i < n; i++) {
		h ^= (unsigned char) s[i];
		h *= 16777619u;
	}
	return h;
}

static void
dump(int full)
{
	PLAYER	*pp;
	BULLET	*bp;
	EXPL	*ep;
	IDENT	*ip;
	int	y, i;
	unsigned h;

	printf("{\"step\":%d,\"seed\":%d,\"maze\":", stepno, Seed);
	if (full) {
		putchar('[');
		for (y = 0; y < HEIGHT; y++) {
			if (y) putchar(',');
			pstr(Maze[y], WIDTH);
		}
		putchar(']');
	} else {
		h = 2166136261u;
		for (y = 0; y < HEIGHT; y++)
			h = fnv(Maze[y], WIDTH, h);
		printf("%u", h);
	}
	printf(",\"players\":[");
	for (pp = Player, i = 0; pp < End_player; pp++, i++) {
		if (pp != Player) putchar(',');
		printf("{\"name\":");
		pstr(pp->p_ident->i_name, strlen(pp->p_ident->i_name));
		printf(",\"team\":");
		pstr(&pp->p_ident->i_team, 1);
		printf(",\"x\":%d,\"y\":%d,\"face\":", pp->p_x, pp->p_y);
		pstr((char *) &pp->p_face, 1);
		printf(",\"over\":");
		pstr(&pp->p_over, 1);
		printf(",\"ammo\":%d,\"damage\":%d,\"damcap\":%d,\"cloak\":%d,\"scan\":%d,"
		    "\"ncshot\":%d,\"flying\":%d,\"flyx\":%d,\"flyy\":%d,\"undershot\":%d,"
		    "\"nboots\":%d,\"queue\":%d",
		    pp->p_ammo, pp->p_damage, pp->p_damcap, pp->p_cloak, pp->p_scan,
		    pp->p_ncshot, pp->p_flying, pp->p_flyx, pp->p_flyy, pp->p_undershot,
		    pp->p_nboots, pp->p_nchar - pp->p_ncount);
		if (full) {
			printf(",\"mem\":[");
			for (y = 0; y < HEIGHT; y++) {
				if (y) putchar(',');
				pstr(pp->p_maze[y], WIDTH);
			}
			printf("],\"screen\":[");
			for (y = 0; y < HEIGHT; y++) {
				if (y) putchar(',');
				pstr(vts[i]->scr[y], WIDTH);
			}
			putchar(']');
		} else {
			h = 2166136261u;
			for (y = 0; y < HEIGHT; y++)
				h = fnv(pp->p_maze[y], WIDTH, h);
			printf(",\"mem\":%u", h);
		}
		putchar('}');
	}
	printf("],\"bullets\":[");
	for (bp = Bullets; bp != NULL; bp = bp->b_next) {
		if (bp != Bullets) putchar(',');
		printf("[%d,%d,", bp->b_x, bp->b_y);
		pstr((char *) &bp->b_face, 1);
		putchar(',');
		pstr(&bp->b_type, 1);
		printf(",%d,%d,", bp->b_charge, bp->b_size);
		pstr(&bp->b_over, 1);
		printf(",%d,", bp->b_expl ? 1 : 0);
		if (bp->b_owner) pstr(bp->b_owner->p_ident->i_name, strlen(bp->b_owner->p_ident->i_name));
		else printf("null");
		putchar(',');
		if (bp->b_score) pstr(bp->b_score->i_name, strlen(bp->b_score->i_name));
		else printf("null");
		putchar(']');
	}
	printf("],\"expl\":[");
	for (i = 0; i < EXPLEN; i++) {
		if (i) putchar(',');
		putchar('[');
		for (ep = Expl[i]; ep != NULL; ep = ep->e_next) {
			if (ep != Expl[i]) putchar(',');
			printf("[%d,%d,", ep->e_y, ep->e_x);
			pstr(&ep->e_char, 1);
			putchar(']');
		}
		putchar(']');
	}
	printf("],\"removed\":[");
	for (i = 0; i < MAXREMOVE; i++)
		printf("%s[%d,%d]", i ? "," : "", removed[i].r_y, removed[i].r_x);
	printf("],\"remIndex\":%d,\"volcano\":%d,\"boots\":[", (int) (rem_index - removed), volcano);
	for (i = 0; i < NBOOTS; i++) {
		pp = &Boot[i];
		printf("%s{\"x\":%d,\"y\":%d,\"face\":", i ? "," : "", pp->p_x, pp->p_y);
		pstr((char *) &pp->p_face, 1);
		printf(",\"over\":");
		pstr(&pp->p_over, 1);
		printf(",\"flying\":%d,\"flyx\":%d,\"flyy\":%d,\"undershot\":%d}",
		    pp->p_flying, pp->p_flyx, pp->p_flyy, pp->p_undershot);
	}
	printf("],\"scores\":[");
	for (ip = Scores; ip != NULL; ip = ip->i_next) {
		if (ip != Scores) putchar(',');
		printf("{\"name\":");
		pstr(ip->i_name, strlen(ip->i_name));
		printf(",\"team\":");
		pstr(&ip->i_team, 1);
		printf(",\"kills\":%.9g,\"entries\":%d,\"score\":%.9g,\"absorbed\":%d,\"faced\":%d,"
		    "\"shot\":%d,\"robbed\":%d,\"slime\":%d,\"missed\":%d,\"ducked\":%d,"
		    "\"gkills\":%d,\"bkills\":%d,\"deaths\":%d,\"stillb\":%d,\"saved\":%d}",
		    ip->i_kills, ip->i_entries, ip->i_score, ip->i_absorbed, ip->i_faced,
		    ip->i_shot, ip->i_robbed, ip->i_slime, ip->i_missed, ip->i_ducked,
		    ip->i_gkills, ip->i_bkills, ip->i_deaths, ip->i_stillb, ip->i_saved);
	}
	printf("],\"msgs\":[%s],\"deaths\":[%s],\"otto\":[%s]}\n", msglog, deathlog, ottolog);
}

static void
init_see_over(void)
{
	int	i;

	for (i = 0; i < NASCII; i++)
		See_over[i] = TRUE;
	See_over[DOOR] = FALSE;
	See_over[WALL1] = FALSE;
	See_over[WALL2] = FALSE;
	See_over[WALL3] = FALSE;
	See_over[WALL4] = FALSE;
	See_over[WALL5] = FALSE;
}

static int
face_char(int c)
{
	switch (c) {
	case '<': return LEFTS;
	case '>': return RIGHT;
	case '^': return ABOVE;
	case 'v': return BELOW;
	}
	return c;
}

static void	bot_save(BOT *);
static void	bot_load(BOT *);

int
main(void)
{
	char	line[512], a[64], b[64], c[64], d[64];
	int	n, y, x, k;
	PLAYER	*pp;
	BOT	*bt;

	setvbuf(stdout, NULL, _IOFBF, 1 << 20);
	while (fgets(line, sizeof line, stdin) != NULL) {
		line[strcspn(line, "\r\n")] = '\0';
		if (line[0] == '#' || line[0] == '\0')
			continue;
		a[0] = b[0] = c[0] = d[0] = '\0';
		n = sscanf(line, "%63s %63s %63s %63s", a, b, c, d);
		if (strcmp(a, "seed") == 0)
			Seed = atoi(b);
		else if (strcmp(a, "init") == 0) {
			init_see_over();
			makemaze();
			makeboots();
		} else if (strcmp(a, "maze") == 0) {
			init_see_over();
			for (y = 0; y < HEIGHT; y++) {
				if (fgets(line, sizeof line, stdin) == NULL)
					break;
				line[strcspn(line, "\r\n")] = '\0';
				for (x = 0; x < WIDTH; x++)
					Maze[y][x] = (x < (int) strlen(line)) ? line[x] : ' ';
			}
			memcpy(Orig_maze, Maze, sizeof Maze);
			for (k = 0; k < NBOOTS; k++)
				Boot[k].p_flying = -1;
		} else if (strcmp(a, "join") == 0) {
			connect_player(b, c[0] == '-' ? ' ' : c[0],
			    d[0] == 's' ? Q_SCAN : d[0] == 'f' ? Q_FLY : Q_CLOAK);
		} else if (strcmp(a, "ensure") == 0) {
			if (find(b) == NULL)
				connect_player(b, c[0] == '-' ? ' ' : c[0],
				    d[0] == 's' ? Q_SCAN : d[0] == 'f' ? Q_FLY : Q_CLOAK);
		} else if (strcmp(a, "bot") == 0) {
			bt = &bots[nbots++];
			strncpy(bt->name, b, NAMELEN);
			pp = find(b);
			bt->team = pp ? pp->p_ident->i_team : ' ';
			initstate(atoi(c), bt->rstate, sizeof bt->rstate);
			bt->have_rstate = 1;
			if (pp != NULL && pp->p_ncount >= pp->p_nchar)
				run_otto(pp, bt);
		} else if (strcmp(a, "autorejoin") == 0)
			autorejoin = atoi(b);
		else if (strcmp(a, "key") == 0) {
			pp = find(b);
			if (pp != NULL)
				append_keys(pp, line + strlen("key ") + strlen(b) + 1);
		} else if (strcmp(a, "place") == 0) {
			pp = find(b);
			y = atoi(c);
			x = atoi(d);
			if (pp != NULL) {
				char *f = strrchr(line, ' ') + 1;
				Maze[pp->p_y][pp->p_x] = pp->p_over;
				pp->p_over = Maze[y][x];
				pp->p_y = y;
				pp->p_x = x;
				pp->p_face = face_char(*f);
				Maze[y][x] = pp->p_face;
			}
		} else if (strcmp(a, "put") == 0) {
			char *f = strrchr(line, ' ') + 1;
			Maze[atoi(b)][atoi(c)] = *f;
		} else if (strcmp(a, "set") == 0) {
			pp = find(b);
			k = atoi(d);
			if (pp == NULL)
				continue;
			if (strcmp(c, "ammo") == 0) pp->p_ammo = k;
			else if (strcmp(c, "damage") == 0) pp->p_damage = k;
			else if (strcmp(c, "damcap") == 0) pp->p_damcap = k;
			else if (strcmp(c, "cloak") == 0) pp->p_cloak = k;
			else if (strcmp(c, "scan") == 0) pp->p_scan = k;
		} else if (strcmp(a, "step") == 0) {
			k = n > 1 ? atoi(b) : 1;
			while (k-- > 0) {
				iterate();
				dump(0);
			}
		} else if (strcmp(a, "fullstep") == 0) {
			k = n > 1 ? atoi(b) : 1;
			while (k-- > 0) {
				iterate();
				dump(1);
			}
		} else if (strcmp(a, "quiet") == 0) {
			k = n > 1 ? atoi(b) : 1;
			while (k-- > 0)
				iterate();
		} else if (strcmp(a, "dump") == 0)
			dump(0);
		else if (strcmp(a, "full") == 0)
			dump(1);
		else {
			fprintf(stderr, "harness: unknown op: %s\n", line);
			return 2;
		}
	}
	fflush(stdout);
	return 0;
}

/* --- otto.c, last: it redefines NORTH/SOUTH/EAST/WEST/RIGHT ------------- */
#define write(fd, buf, n)	(otto_write((buf), (n)), 0)
#define setitimer(a, b, c)	0
#define sigpause(m)		0
#define sigblock(m)		0
#define sigsetmask(m)		0
#ifndef sigmask
#define sigmask(s)		0
#endif
#include "otto.c"
#undef write

static void
bot_save(BOT *bt)
{
	bt->num_turns = num_turns;
	memcpy(bt->been_there, been_there, sizeof been_there);
}

static void
bot_load(BOT *bt)
{
	num_turns = bt->num_turns;
	memcpy(been_there, bt->been_there, sizeof been_there);
}

static void
run_otto(PLAYER *pp, BOT *bt)
{
	int	i, y, x;
	char	f;

	if (pp->p_face != LEFTS && pp->p_face != '}' && pp->p_face != 'i'
	    && pp->p_face != '!')
		return;			/* flying: otto has no glyph to steer by */
	i = pp - Player;
	for (y = 0; y < SCREEN_HEIGHT; y++)
		for (x = 0; x < SCREEN_WIDTH; x++)
			screen[y][x] = vts[i]->scr[y][x];
	f = translate(pp->p_face);
	setstate(bt->rstate);
	bot_load(bt);
	otto_pp = pp;
	otto(pp->p_y, pp->p_x, f);
	bot_save(bt);
}
