// Practical exam rules (B and C) from the two instruction videos in
// Desktop\avtodrom (summary: blender/exam_spec.md). Pure logic: the game feeds
// the car's state every frame and gets back the penalties it earned and why.
import type { Category } from './vehicles';
import { distToIslands, inRect, type Course, type Rect } from './course';
import type { Gear } from './physics';

export type Light = 'red' | 'yellow' | 'green';
export type Approach = 'N' | 'S' | 'E' | 'W';

export interface Pt {
  x: number;
  z: number;
}

export interface ExamFrame {
  dt: number;
  /** Car centre, unit forward vector (plan axes), key points. */
  pos: Pt;
  dir: Pt;
  bumperFront: Pt;
  bumperRear: Pt;
  axleFront: Pt;
  axleRear: Pt;
  /** Wheel contact points fl, fr, rl, rr. */
  wheels: [Pt, Pt, Pt, Pt];
  kmh: number; // signed, + forward
  gear: Gear;
  throttle: number;
  handbrake: boolean;
  engineOn: boolean;
  belt: boolean;
  signal: -1 | 0 | 1;
  hazard: boolean;
  /** Light shown to a car coming from this approach. */
  light(a: Approach): Light;
}

export interface Penalty {
  code: string;
  points: number;
  uz: string;
  ru: string;
  t: number;
}

export interface ExamStatus {
  total: number;
  list: Penalty[];
  ended: null | 'finish' | 'fail';
  /** Short name of the exercise the car is in now. */
  where: { uz: string; ru: string } | null;
  /** Next exercise on the route and where it is (plan metres). */
  next: { uz: string; ru: string; x: number; z: number } | null;
  /** In-cabin emergency signal is sounding. */
  alarm: boolean;
  /** After the finish line: what still has to be done. */
  finishTodo: null | { handbrake: boolean; engine: boolean; belt: boolean };
  /** Seconds since the start signal. */
  time: number;
}

/** Points per rule: [B, C] (0 = rule not used in that category). */
const PTS: Record<string, [number, number]> = {
  belt: [5, 5],
  late_start: [25, 25],
  start_signal: [5, 5],
  start_signal_off: [5, 5],
  zebra_far: [5, 5],
  zebra_bumper: [20, 20],
  zebra_wheel: [20, 100],
  zebra_nostop: [20, 100],
  zebra_rush: [20, 20],
  ramp_rollback: [20, 20],
  ramp_stuck: [25, 25],
  yellow: [20, 20],
  slow: [15, 15],
  red: [100, 100],
  turn_signal: [5, 5],
  box_line: [20, 20],
  stall: [20, 20],
  rail_bumper: [0, 70],
  rail_nostop: [50, 100],
  no_second: [25, 25],
  over40: [100, 100],
  emerg_stop: [20, 20],
  emerg_hazard: [20, 20],
  emerg_hazard_on: [0, 10],
  par_line: [20, 20],
  par_yellow: [20, 0],
  par_short: [20, 0],
  finish_signal: [5, 5],
  off_route: [100, 100],
  reverse: [100, 100],
  speed20: [20, 20],
};

const TXT: Record<string, [string, string]> = {
  belt: ['Хавфсизлик камари тақилмаган', 'Не пристёгнут ремень безопасности'],
  late_start: ['Старт ишорасидан кейин 30 сонияда қўзғалмади', 'Не тронулся за 30 секунд после сигнала старта'],
  start_signal: ['Старт чизиғидан чап чироқсиз ўтди', 'Пересёк линию старта без левого поворотника'],
  start_signal_off: ['Стартдан кейин 10 м ичида чироқ ўчирилмади', 'Поворотник не выключен в 10 м после старта'],
  zebra_far: ['Тўхташ чизиғидан 1 м дан узоқда тўхтади', 'Остановился дальше 1 м от стоп-линии'],
  zebra_bumper: ['Тўхташ чизиғини босди', 'Заехал на стоп-линию'],
  zebra_wheel: ['Ғилдирак тўхташ чизиғидан ўтди', 'Колесо за стоп-линией'],
  zebra_nostop: ['Пиёдалар ўтиш жойи олдида тўхтамади', 'Не остановился перед пешеходным переходом'],
  zebra_rush: ['Тўхтагач 3 сония кутмади', 'Не выждал 3 секунды после остановки'],
  ramp_rollback: ['Эстакадада 30 см дан кўп орқага кетди', 'Откат на эстакаде больше 30 см'],
  ramp_stuck: ['Эстакадада 30 сония туриб қолди', 'Простоял на эстакаде 30 секунд'],
  yellow: ['Сариқ чизиқни босди', 'Наезд на жёлтую линию'],
  slow: ['Машқ 2 дақиқадан ошди', 'Упражнение дольше 2 минут'],
  red: ['Қизил чироққа ўтди', 'Проезд на красный свет'],
  turn_signal: ['Чорраҳада бурилиш чироғи ёқилмади', 'Поворот на перекрёстке без поворотника'],
  box_line: ['Орқа ғилдираклар оқ чизиқда эмас', 'Задние колёса не на белой линии'],
  stall: ['Двигатель ўчиб қолди', 'Заглох двигатель'],
  rail_bumper: ['Бампер STOP чизиғидан чиқди', 'Бампер за линией STOP'],
  rail_nostop: ['Темир йўл кесишмасида тўхтамади', 'Не остановился перед ж/д переездом'],
  no_second: ['Тезлашиш бўлагида 2-узатма қўшилмади', 'На разгоне не включена 2-я передача'],
  over40: ['Тезлик 40 км/соатдан ошди', 'Скорость выше 40 км/ч'],
  emerg_stop: ['Авария ишорасидан кейин 2 сонияда тўхтамади', 'Не остановился за 2 с по аварийному сигналу'],
  emerg_hazard: ['3 сонияда авария чироғи ёқилмади', 'Не включил аварийку за 3 с'],
  emerg_hazard_on: ['Авария чироғи ўчирилмасдан юрди', 'Тронулся с включённой аварийкой'],
  par_line: ['Ўнг ғилдираклар оқ чизиқда эмас', 'Правые колёса не на белой линии'],
  par_yellow: ['Сариқ чизиқни босиб турди', 'Стоит на жёлтой линии'],
  par_short: ['Жойга чала тўхтади', 'Не до конца встал на место'],
  finish_signal: ['Финишда ўнг чироқ ёқилмади', 'На финише не включён правый поворотник'],
  off_route: ['Йўналишдан чиқди (бошқа тоифа йўлаги)', 'Сход с маршрута (полоса другой категории)'],
  reverse: ['Рухсатсиз орқага юрди', 'Движение задним ходом без разрешения'],
  speed20: ['Тезлик 20 км/соатдан ошди', 'Скорость выше 20 км/ч'],
};

const WHERE: Record<string, [string, string]> = {
  start: ['Старт', 'Старт'],
  zebra: ['Пиёдалар йўли', 'Пешеходный переход'],
  ramp: ['Эстакада', 'Эстакада'],
  turns90: ['90° бурилишлар', 'Повороты 90°'],
  cross: ['Чорраҳа', 'Перекрёсток'],
  snake: ['Илон изи', 'Змейка'],
  box: ['Бокс', 'Бокс'],
  rail: ['Темир йўл', 'Ж/д переезд'],
  accel: ['Тезлашиш', 'Разгон'],
  emergency: ['Авария тўхташ', 'Аварийная остановка'],
  parallel: ['Параллел тўхташ', 'Параллельная парковка'],
  finish: ['Финиш', 'Финиш'],
};

export function examRuleText(code: string) {
  return TXT[code];
}

export function createExam(category: Category, course: Course) {
  const ci = category === 'B' ? 0 : 1;
  const other: Category = category === 'B' ? 'C' : 'B';
  const list: Penalty[] = [];
  let total = 0;
  let time = 0;
  let ended: ExamStatus['ended'] = null;
  const fresh: Penalty[] = [];

  const add = (code: string) => {
    const points = PTS[code][ci];
    if (!points || ended) return;
    const [uz, ru] = TXT[code];
    const p = { code, points, uz, ru, t: time };
    list.push(p);
    fresh.push(p);
    total += points;
    if (total >= 100) ended = 'fail';
  };

  // ---- per-exercise state
  let moved = 0; // metres since the start signal
  let beltChecked = false;
  let lateChecked = false;
  let startCrossed = false;
  let signalOffFrom: Pt | null = null;
  let signalOffDone = false;

  const zebra = { done: false, stoppedAt: -1, judged: false, leftEarly: false };
  const ramp = { stopZ: null as number | null, stopT: 0, rolled: false, stuck: false };
  const timed: Record<'turns90' | 'snake', { in: boolean; t: number; slow: boolean }> = {
    turns90: { in: false, t: 0, slow: false },
    snake: { in: false, t: 0, slow: false },
  };
  let yellowTouch = false;
  let yellowCool = 0;
  const cross = { in: false, from: null as Approach | null, signal: 0 as -1 | 0 | 1, heading: 0 };
  const box = { in: false, good: false, stops: 0 };
  const par = { in: false, good: false, full: false, stops: 0, yellowT: 0 };
  let stillT = 0;
  const rail = { done: false, stopped: false, bumper: false };
  const accel = { in: false, second: false, over: false };
  const emerg = { triggered: false, t: 0, stopped: false, hazard: false, judgedStop: false, judgedHaz: false, armedMove: false, movedFrom: null as Pt | null, hazOnPen: false };
  const stall = { lastOn: true, offT: 0, chargedT: 0 };
  let revDist = 0;
  let speedCool = 0;
  const finish = { crossed: false, stopped: false };
  let lastPos: Pt | null = null;

  // Route order (both categories drive the same sequence, their own box and bay).
  const route: { key: string; r: Rect }[] = [
    { key: 'zebra', r: course.zebra },
    { key: 'ramp', r: course.ramp },
    { key: 'turns90', r: course.turns90 },
    { key: 'cross', r: course.cross },
    { key: 'snake', r: course.snake },
    { key: 'box', r: course.box[category].rect },
    { key: 'rail', r: course.rail },
    { key: 'accel', r: course.accel },
    { key: 'emergency', r: course.emergency },
    { key: 'parallel', r: course.parallel[category].rect },
    { key: 'finish', r: course.finish },
  ];
  let routeIdx = 0;

  const headingOf = (d: Pt) => Math.atan2(d.z, d.x);
  const angDiff = (a: number, b: number) => {
    let d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  };
  const approachOf = (r: Rect, p: Pt): Approach => {
    const dn = Math.abs(p.z - r.z0);
    const ds = Math.abs(p.z - r.z1);
    const dw = Math.abs(p.x - r.x0);
    const de = Math.abs(p.x - r.x1);
    const m = Math.min(dn, ds, dw, de);
    return m === dn ? 'N' : m === ds ? 'S' : m === dw ? 'W' : 'E';
  };
  const yellowAt = (p: Pt) => {
    if (!course.yellowZones.some((r) => inRect(r, p.x, p.z))) return false;
    return distToIslands(course.islands, p.x, p.z) <= course.edgeOff + course.edgeW / 2 + 0.1;
  };

  function update(f: ExamFrame): Penalty[] {
    fresh.length = 0;
    if (ended) return [];
    const dt = f.dt;
    time += dt;
    const speed = Math.abs(f.kmh);
    const still = speed < 0.6;
    stillT = still ? stillT + dt : 0;
    const step = lastPos ? Math.hypot(f.pos.x - lastPos.x, f.pos.z - lastPos.z) : 0;
    lastPos = { ...f.pos };
    moved += step;
    const heading = headingOf(f.dir);
    for (let k = routeIdx; k < route.length; k++) {
      if (inRect(route[k].r, f.pos.x, f.pos.z)) {
        routeIdx = k + 1;
        break;
      }
    }

    // ---------------- start
    if (!beltChecked && moved > 0.5) {
      beltChecked = true;
      if (!f.belt) add('belt');
    }
    if (!lateChecked && time > 30) {
      lateChecked = true;
      if (moved < 1) add('late_start');
    }
    if (!startCrossed && inRect(course.start, f.pos.x, f.pos.z, 2) && f.bumperFront.z < course.startLine && f.dir.z < 0) {
      startCrossed = true;
      if (f.signal !== -1) add('start_signal');
    }
    if (startCrossed && !signalOffDone && f.axleRear.z < course.startLine) {
      signalOffFrom ??= { ...f.axleRear };
      const d = Math.hypot(f.axleRear.x - signalOffFrom.x, f.axleRear.z - signalOffFrom.z);
      if (f.signal === 0) signalOffDone = true;
      else if (d > 10) {
        signalOffDone = true;
        add('start_signal_off');
      }
    }

    // ---------------- 2: zebra (northbound, stop line at zebraLine)
    if (!zebra.done && inRect(course.zebra, f.bumperFront.x, f.bumperFront.z, 0.5) && f.dir.z < 0) {
      const before = f.bumperFront.z - course.zebraLine; // > 0: in front of the line
      if (still && stillT > 0.4 && zebra.stoppedAt < 0 && before < 6) {
        zebra.stoppedAt = time;
        if (f.axleFront.z < course.zebraLine) add('zebra_wheel');
        else if (before < 0) add('zebra_bumper');
        else if (before > 1) add('zebra_far');
        zebra.judged = true;
      }
      if (zebra.stoppedAt >= 0 && !still && time - zebra.stoppedAt < 3 && !zebra.leftEarly) {
        zebra.leftEarly = true;
        add('zebra_rush');
      }
      if (f.axleRear.z < course.zebraLine - 1) {
        zebra.done = true;
        if (zebra.stoppedAt < 0) add('zebra_nostop');
      }
    }

    // ---------------- 1: estakada
    const onRamp = inRect(course.ramp, f.pos.x, f.pos.z);
    if (onRamp && f.pos.z < course.rampFootS && f.pos.z > course.rampTopS - 1) {
      if (still && stillT > 0.5 && ramp.stopZ === null) {
        ramp.stopZ = f.pos.z;
        ramp.stopT = time;
      }
      if (ramp.stopZ !== null) {
        if (f.pos.z - ramp.stopZ > 0.3 && !ramp.rolled) {
          ramp.rolled = true;
          add('ramp_rollback');
        }
        if (still && time - ramp.stopT > 30 && !ramp.stuck) {
          ramp.stuck = true;
          add('ramp_stuck');
        }
        if (ramp.stopZ - f.pos.z > 1.5) {
          ramp.stopZ = null; // drove on; a new stop is judged again
          ramp.rolled = false;
        }
      }
    } else ramp.stopZ = null;

    // ---------------- 3 and 5: yellow lines and time limits
    for (const k of ['turns90', 'snake'] as const) {
      const r = k === 'turns90' ? course.turns90 : course.snake;
      const st = timed[k];
      const inside = inRect(r, f.pos.x, f.pos.z);
      if (inside && !st.in) {
        st.in = true;
        st.t = time;
        st.slow = false;
      } else if (!inside && st.in) st.in = false;
      if (st.in && !st.slow && time - st.t > 120) {
        st.slow = true;
        add('slow');
      }
    }
    yellowCool -= dt;
    const inYellowExercise = timed.turns90.in || timed.snake.in;
    const touching = f.wheels.some((w) => yellowAt(w));
    if (inYellowExercise) {
      if (touching && !yellowTouch && yellowCool <= 0) {
        add('yellow');
        yellowCool = 2;
      }
    }
    yellowTouch = touching;

    // ---------------- 4: intersection
    const inCross = inRect(course.cross, f.pos.x, f.pos.z);
    if (inCross && !cross.in) {
      cross.in = true;
      const from = approachOf(course.cross, f.pos);
      cross.from = from;
      cross.signal = f.signal;
      cross.heading = heading;
      if (f.light(from) === 'red') {
        add('red');
        ended = 'fail';
      }
    } else if (inCross && cross.in && cross.signal === 0 && f.signal !== 0) {
      cross.signal = f.signal;
    } else if (!inCross && cross.in) {
      cross.in = false;
      const turn = angDiff(heading, cross.heading);
      if (Math.abs(turn) > 0.9) {
        const want: -1 | 1 = turn < 0 ? -1 : 1;
        if (cross.signal !== want) add('turn_signal');
      }
    }

    // ---------------- 6: box (mine), other category's box = off route
    const myBox = course.box[category];
    const inBox = inRect(myBox.rect, f.pos.x, f.pos.z);
    if (inBox) {
      box.in = true;
      if (still && stillT > 1 && f.gear !== '1' && f.gear !== '2') {
        box.stops++;
        const rz = (f.wheels[2].z + f.wheels[3].z) / 2;
        if (Math.abs(rz - myBox.line) <= 0.35) box.good = true;
      }
    } else if (box.in) {
      box.in = false;
      if (box.stops > 0 && !box.good) add('box_line');
      if (box.stops === 0) add('box_line');
      box.stops = -1e9; // judged once
    }
    if (inRect(course.box[other].rect, f.pos.x, f.pos.z, -0.5)) {
      add('off_route');
      ended = 'fail';
    }

    // ---------------- 9: parallel parking (mine), other category's = off route
    const myPar = course.parallel[category];
    const inPar = inRect(myPar.rect, f.pos.x, f.pos.z, 1.0);
    if (inPar) {
      par.in = true;
      if (still && stillT > 1) {
        par.stops++;
        const onLine = Math.abs(f.wheels[1].x - myPar.line) <= 0.35 && Math.abs(f.wheels[3].x - myPar.line) <= 0.35;
        if (onLine) par.good = true;
        if (f.wheels.every((w) => inRect(myPar.rect, w.x, w.z, 0.3))) par.full = true;
      }
      if (category === 'B') {
        // standing on the yellow line: 20 points, and again every 3 s
        if (f.wheels.some((w) => yellowAt(w))) {
          if (par.yellowT === 0) add('par_yellow');
          par.yellowT += dt;
          if (par.yellowT >= 3) par.yellowT = 0;
        } else par.yellowT = 0;
      }
    } else if (par.in) {
      par.in = false;
      if (par.stops > 0) {
        if (!par.good) add('par_line');
        if (!par.full) add('par_short');
      } else add('par_short');
      par.stops = -1e9;
    }
    if (inRect(course.parallel[other].rect, f.pos.x, f.pos.z, -0.5)) {
      add('off_route');
      ended = 'fail';
    }

    // ---------------- 7: railway (westbound, stop line x)
    if (!rail.done && inRect(course.rail, f.bumperFront.x, f.bumperFront.z) && f.dir.x < 0) {
      const before = f.bumperFront.x - course.railLine;
      if (still && stillT > 0.4 && before > -1.5 && before < 8 && !rail.stopped) {
        rail.stopped = true;
        if (before < 0) add('rail_bumper');
      }
      if (f.bumperFront.x < course.railLine - 2.5) {
        rail.done = true;
        if (!rail.stopped) add('rail_nostop');
      }
    }

    // ---------------- 8: acceleration lane
    const inAccel = inRect(course.accel, f.pos.x, f.pos.z) && f.dir.z > 0.3;
    if (inAccel) {
      accel.in = true;
      if (f.gear === '2') accel.second = true;
      if (speed > 40 && !accel.over) {
        accel.over = true;
        add('over40');
        ended = 'fail';
      }
    } else if (accel.in && f.pos.z > course.accel.z1) {
      accel.in = false;
      if (!accel.second) add('no_second');
      accel.second = true; // judged once
    }

    // ---------------- emergency stop (signal right after the acceleration lane)
    if (!emerg.triggered && inRect(course.emergency, f.pos.x, f.pos.z) && f.dir.z > 0.3 && speed > 4 && accel.second) {
      emerg.triggered = true;
      emerg.t = time;
    }
    if (emerg.triggered) {
      const t = time - emerg.t;
      if (!emerg.stopped && still) emerg.stopped = true;
      if (!emerg.hazard && f.hazard) emerg.hazard = true;
      if (!emerg.judgedStop && t > 2.5) {
        emerg.judgedStop = true;
        if (!emerg.stopped) add('emerg_stop');
      }
      if (!emerg.judgedHaz && t > 3) {
        emerg.judgedHaz = true;
        if (!emerg.hazard) add('emerg_hazard');
      }
      if (emerg.stopped && emerg.hazard && !emerg.hazOnPen) {
        emerg.movedFrom ??= { ...f.pos };
        const d = Math.hypot(f.pos.x - emerg.movedFrom.x, f.pos.z - emerg.movedFrom.z);
        if (d > 1.5) {
          emerg.hazOnPen = true;
          if (f.hazard) add('emerg_hazard_on');
        }
      }
    }

    // ---------------- engine stall
    if (stall.lastOn && !f.engineOn && moved > 0.5 && !finish.crossed) {
      // engine went off while driving the course
      stall.offT = time;
      stall.chargedT = time;
      if (category === 'B') add('stall');
    }
    if (category === 'C' && !f.engineOn && moved > 0.5 && !finish.crossed && time - stall.chargedT >= 3) {
      stall.chargedT = time;
      add('stall');
    }
    stall.lastOn = f.engineOn;

    // ---------------- reversing outside the box / parallel areas
    const reversing = f.gear === 'R' && f.kmh < -0.8;
    const revAllowed = inRect(myBox.rect, f.pos.x, f.pos.z, 14) || inRect(myPar.rect, f.pos.x, f.pos.z, 14);
    if (reversing && !revAllowed) {
      revDist += step;
      if (revDist > 3) {
        revDist = -1e9;
        add('reverse');
        ended = 'fail';
      }
    } else if (!reversing) revDist = Math.max(0, revDist);

    // ---------------- 20 km/h outside the acceleration lane
    speedCool -= dt;
    const fastOk = inRect(course.accel, f.pos.x, f.pos.z, 2) || inRect(course.emergency, f.pos.x, f.pos.z, 2);
    if (!fastOk && speed > 21 && speedCool <= 0) {
      add('speed20');
      speedCool = 1e9;
    }
    if (speed < 18 && speedCool > 1e8) speedCool = 4;

    // ---------------- finish
    if (!finish.crossed && inRect(course.finish, f.bumperFront.x, f.bumperFront.z) && f.dir.z > 0 && f.bumperFront.z > course.finishLine) {
      finish.crossed = true;
      if (f.signal !== 1) add('finish_signal');
    }
    if (finish.crossed && still && stillT > 0.5) finish.stopped = true;
    if (finish.crossed && finish.stopped && f.handbrake && !f.engineOn && !f.belt && !ended) ended = 'finish';

    return fresh.slice();
  }

  function status(f: ExamFrame | null): ExamStatus {
    let where: string | null = null;
    if (f) {
      const p = f.pos;
      if (!startCrossed) where = 'start';
      else if (inRect(course.zebra, p.x, p.z) && !zebra.done) where = 'zebra';
      else if (inRect(course.ramp, p.x, p.z)) where = 'ramp';
      else if (timed.turns90.in) where = 'turns90';
      else if (timed.snake.in) where = 'snake';
      else if (inRect(course.cross, p.x, p.z, 8)) where = 'cross';
      else if (inRect(course.box[category].rect, p.x, p.z, 8)) where = 'box';
      else if (inRect(course.rail, p.x, p.z)) where = 'rail';
      else if (inRect(course.accel, p.x, p.z)) where = 'accel';
      else if (emerg.triggered && time - emerg.t < 8) where = 'emergency';
      else if (inRect(course.parallel[category].rect, p.x, p.z, 8)) where = 'parallel';
      else if (finish.crossed || inRect(course.finish, p.x, p.z)) where = 'finish';
    }
    return {
      total,
      list: list.slice(),
      ended,
      where: where ? { uz: WHERE[where][0], ru: WHERE[where][1] } : null,
      next:
        routeIdx < route.length
          ? {
              uz: WHERE[route[routeIdx].key][0],
              ru: WHERE[route[routeIdx].key][1],
              x: (route[routeIdx].r.x0 + route[routeIdx].r.x1) / 2,
              z: (route[routeIdx].r.z0 + route[routeIdx].r.z1) / 2,
            }
          : null,
      alarm: emerg.triggered && !emerg.judgedHaz && !(emerg.stopped && emerg.hazard),
      finishTodo: finish.crossed && !ended && f ? { handbrake: f.handbrake, engine: !f.engineOn, belt: !f.belt } : null,
      time,
    };
  }

  return {
    update,
    status,
    /** Manual end (player gives up / leaves). */
    get total() {
      return total;
    },
  };
}

export type Exam = ReturnType<typeof createExam>;
