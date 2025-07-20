const toPixels = (ratio) => (canvas) =>
  (ratio * Math.min(canvas.width, canvas.height)) / window.devicePixelRatio;

// Sizes, in fraction of min(canvas.width, canvas.height)
const InnerCircleDiameter = toPixels(0.12);
const OuterCircleDiameter = toPixels(0.2);
const OuterCircleThickness = toPixels(0.02);
const MaskCircleDiameter = toPixels(0.32);
const RadiusOscillationSize = toPixels(0.005);
const FontSize = toPixels(0.06);

// Growing animation
const GrowAnimationDuration = 0.1; // seconds

// Pulsing animation
const RadiusOscillationDuration = 1 / 2; // seconds

// Arc gap animation
const GapBase = 1 / 12; // in pct of full circle
const GapOscillationDuration = 1; // seconds

// Winner circle animation
const WinnerAnimationDuration = 1; // seconds

// Deleted participant animation
const DeletedParticipantAnimationDuration = 0.1; // seconds

const Background = "#212121";

const getRadius = ({ diff, base, canvas }) => {
  if (diff < GrowAnimationDuration) {
    return (base * diff) / GrowAnimationDuration;
  }
  const oscillation =
    RadiusOscillationSize(canvas) *
    Math.sin(
      (1 / RadiusOscillationDuration) * Math.PI * (diff - GrowAnimationDuration)
    );
  return base + oscillation;
};

const getArc = (diff) => {
  if (diff >= GapOscillationDuration * 2) {
    return { start: 0, end: Math.PI * 2 };
  }
  const start = Math.PI * diff;

  const gapBaseRadians = Math.PI * 2 * GapBase;
  const gapOscillation =
    gapBaseRadians *
    Math.sin(
      (1 / GapOscillationDuration) *
        Math.PI *
        (diff - GapOscillationDuration / 2)
    );
  const gap = gapBaseRadians + gapOscillation;

  const end = start + Math.PI * 2 - gap;

  return { start: start % (Math.PI * 2), end: end % (Math.PI * 2) };
};

const drawLabel = ({ canvas, ctx, participant }) => {
  ctx.font = `bold ${FontSize(canvas)}px sans-serif`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillStyle = Background;
  ctx.strokeStyle = undefined;
  ctx.lineWidth = undefined;
  ctx.fillText(
    participant.label.toUpperCase(),
    participant.x,
    // small nudge to make text more centered
    participant.y + FontSize(canvas) / 16
  );
};

const drawParticipant = ({ canvas, ctx, participant, frame }) => {
  const { x, y, colour, startFrame } = participant;
  const frameDiff = frame - startFrame;
  const diff = frameDiff / window.fps;

  // Winner
  if (participant.winner) {
    const winnerDiff = (frame - participant.winnerFrame) / window.fps;
    ctx.fillStyle = colour;
    ctx.strokeStyle = undefined;
    ctx.lineWidth = undefined;
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.fill();

    ctx.fillStyle = Background;
    ctx.beginPath();
    ctx.arc(
      x,
      y,
      Math.max(1 - winnerDiff / WinnerAnimationDuration, 0) *
        Math.min(canvas.width, canvas.height) +
        MaskCircleDiameter(canvas) / 2,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  // Inner circle
  const innerCircleRadius = getRadius({
    diff,
    base: InnerCircleDiameter(canvas) / 2,
    canvas,
  });
  ctx.fillStyle = colour;
  ctx.strokeStyle = undefined;
  ctx.lineWidth = undefined;
  ctx.beginPath();
  ctx.arc(x, y, innerCircleRadius, 0, 2 * Math.PI);
  ctx.fill();

  // Outer circle
  const outerCircleRadius = getRadius({
    diff,
    base: OuterCircleDiameter(canvas) / 2,
    canvas,
  });
  const outerCircleArc = getArc(diff);
  ctx.fillStyle = undefined;
  ctx.strokeStyle = colour;
  ctx.lineWidth = OuterCircleThickness(canvas);
  ctx.beginPath();
  ctx.arc(x, y, outerCircleRadius, outerCircleArc.start, outerCircleArc.end);
  ctx.stroke();

  // Label
  if (participant.label) {
    drawLabel({ canvas, ctx, participant });
  }
};

const drawDeletedParticipant = ({ canvas, ctx, participant, frame }) => {
  const { x, y, colour, startFrame, deletedFrame } = participant;
  const diffWhenDeleted = (deletedFrame - startFrame) / window.fps;
  const diffToStart = (frame - startFrame) / window.fps;
  const diffToDeleted = (frame - deletedFrame) / window.fps;

  // Inner circle
  const innerCircleRadiusWhenDeleted = getRadius({
    diff: diffWhenDeleted,
    base: InnerCircleDiameter(canvas) / 2,
    canvas,
  });
  const innerCircleRadius =
    (1 - diffToDeleted / DeletedParticipantAnimationDuration) *
    innerCircleRadiusWhenDeleted;
  ctx.fillStyle = colour;
  ctx.strokeStyle = undefined;
  ctx.lineWidth = undefined;
  ctx.beginPath();
  ctx.arc(x, y, innerCircleRadius, 0, 2 * Math.PI);
  ctx.fill();

  // Outer circle
  const outerCircleRadiusWhenDeleted = getRadius({
    diff: diffWhenDeleted,
    base: OuterCircleDiameter(canvas) / 2,
    canvas,
  });
  const outerCircleRadius =
    (1 - diffToDeleted / DeletedParticipantAnimationDuration) *
    outerCircleRadiusWhenDeleted;
  const outerCircleArc = getArc(diffToStart);
  ctx.fillStyle = undefined;
  ctx.strokeStyle = colour;
  ctx.lineWidth = OuterCircleThickness(canvas);
  ctx.beginPath();
  ctx.arc(x, y, outerCircleRadius, outerCircleArc.start, outerCircleArc.end);
  ctx.stroke();
};

class Renderer {
  frame = 0;
  prevParticipants = {};
  deletedParticipants = {};

  constructor({ canvas, getParticipants }) {
    this.canvas = canvas;
    this.getParticipants = getParticipants;
    this.animationLoop();
    this.setDevicePixelRatio();
    this.attachResizeListener();
  }

  setDevicePixelRatio = () => {
    const { canvas } = this;

    const dpr = window.devicePixelRatio ?? 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;

    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
  };

  attachResizeListener = () => {
    window.addEventListener("resize", this.setDevicePixelRatio);
  };

  animationLoop = () => {
    this.updateDeletedParticipants();
    this.draw();
    this.frame++;
    requestAnimationFrame(this.animationLoop);
  };

  updateDeletedParticipants = () => {
    const participants = this.getParticipants();
    const prevParticipants = this.prevParticipants;

    Object.keys(this.deletedParticipants).forEach((id) => {
      if (
        this.frame - this.deletedParticipants[id].deletedFrame >=
        DeletedParticipantAnimationDuration * window.fps
      ) {
        delete this.deletedParticipants[id];
      }
    });

    const newDeletedParticipants = Object.entries(prevParticipants).filter(
      ([id]) => participants[id] === undefined
    );
    newDeletedParticipants.forEach(([id, value]) => {
      this.deletedParticipants[id] = {
        ...value,
        deletedFrame: this.frame,
      };
    });
    this.prevParticipants = { ...participants };
  };

  draw = () => {
    const participants = this.getParticipants();
    const participantsList = Object.values(participants);
    const deletedParticipants = this.deletedParticipants;
    const deletedParticipantsList = Object.values(deletedParticipants);
    const frame = this.frame;
    const ctx = this.canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    participantsList.forEach((participant) => {
      if (participant.hide) {
        return;
      }
      drawParticipant({ canvas, ctx, participant, frame });
    });
    deletedParticipantsList.forEach((deletedParticipant) => {
      if (deletedParticipant.hide) {
        return;
      }
      drawDeletedParticipant({
        canvas,
        ctx,
        participant: deletedParticipant,
        frame,
      });
    });
  };
}

const MaxTouchPoints = window.mobileCheck()
  ? Math.min(Math.max(navigator.maxTouchPoints, 1), 10)
  : 10;
const TimeUntilPick = 2.5; // seconds

class Colour {
  pool = [
    "#ef5350",
    "#ec407a",
    "#ab47bc",
    "#7e57c2",
    "#5c6bc0",
    "#29b6f6",
    "#26a69a",
    "#66bb6a",
    "#9ccc65",
    "#ffee58",
    "#ffca28",
    "#ffa726",
    "#ff7043",
  ];

  getColour = () => {
    if (this.pool.length === 0) {
      return;
    }
    const index = Math.floor(Math.random() * this.pool.length);
    const colour = this.pool[index];
    this.pool.splice(index, 1);
    return colour;
  };

  cedeColour = (colour) => {
    this.pool.push(colour);
  };
}

const colours = new Colour();

const ValidKeys = [
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "g",
  "h",
  "i",
  "j",
  "k",
  "l",
  "m",
  "n",
  "o",
  "p",
  "q",
  "r",
  "s",
  "t",
  "u",
  "v",
  "w",
  "x",
  "y",
  "z",
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
];

const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

class Picker {
  participants = {};
  chooseTimer = undefined;

  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new Renderer({
      canvas,
      getParticipants: this.getParticipants,
    });
    this.attachEventListeners();
  }

  attachEventListeners = () => {
    if (window.mobileCheck()) {
      this.canvas.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        this.addParticipant({
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
        });
      });
      this.canvas.addEventListener("pointermove", (event) => {
        event.preventDefault();
        this.moveParticipant({
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
        });
      });
      this.canvas.addEventListener("pointerup", (event) => {
        event.preventDefault();
        this.removeParticipant({
          id: event.pointerId,
        });
      });

      this.canvas.addEventListener("contextmenu", (event) =>
        event.preventDefault()
      );
    } else {
      window.addEventListener("keydown", (event) => {
        if (ValidKeys.includes(event.key)) {
          event.preventDefault();
          if (this.participants[event.key]) {
            return;
          }
          this.addParticipant({
            id: event.key,
            x: clamp(
              Math.random() * this.canvas.width,
              MaskCircleDiameter(this.canvas) / 2,
              this.canvas.width - MaskCircleDiameter(this.canvas) / 2
            ),
            y: clamp(
              Math.random() * this.canvas.height,
              MaskCircleDiameter(this.canvas) / 2,
              this.canvas.height - MaskCircleDiameter(this.canvas) / 2
            ),
            label: event.key,
          });
        }
      });
      window.addEventListener("keyup", (event) => {
        if (ValidKeys.includes(event.key)) {
          this.removeParticipant({ id: event.key });
          event.preventDefault();
        }
      });
    }
  };

  getParticipants = () => this.participants;

  resetChooseTimer = () => {
    clearTimeout(this.chooseTimer);

    if (Object.keys(this.participants).length < 2) {
      this.chooseTimer = undefined;
      return;
    }

    this.chooseTimer = setTimeout(() => {
      if (Object.keys(this.participants).length < 2) {
        this.chooseTimer = undefined;
        return;
      }
      const ids = Object.keys(this.participants);
      const winnerIndex = Math.floor(Math.random() * ids.length);
      const winner = ids[winnerIndex];
      ids.forEach((id) => {
        if (id === winner) {
          this.participants[id].winner = true;
          this.participants[id].winnerFrame = this.renderer.frame;
        } else {
          this.participants[id].hide = true;
        }
      });
    }, TimeUntilPick * 1000);
  };

  addParticipant = ({ id, x, y, label }) => {
    const participantCount = Object.keys(this.participants).length;
    if (participantCount >= MaxTouchPoints) {
      return;
    }
    if (
      participantCount === 1 &&
      Object.entries(this.participants)[0][1].winner
    ) {
      this.participants = {};
    }
    const colour = colours.getColour();
    if (colour === undefined) {
      return;
    }
    const frame = this.renderer.frame;
    this.participants[id] = { x, y, colour, startFrame: frame, label };
    this.resetChooseTimer();
  };

  moveParticipant = ({ id, x, y }) => {
    if (this.participants[id] === undefined) {
      return;
    }
    this.participants[id].x = x;
    this.participants[id].y = y;
  };

  removeParticipant = ({ id }) => {
    if (this.participants[id] === undefined) {
      return;
    }
    colours.cedeColour(this.participants[id].colour);
    delete this.participants[id];
    this.resetChooseTimer();
  };
}

const canvas = document.getElementById("main");
new Picker(canvas);
