const InnerCircleDiameter = 120;
const InnerOuterGap = 30;
const OuterCircleDiameter = 200;
const OuterCircleThickness = 20;

// Growing animation
const GrowAnimationDuration = 0.1; // seconds

// Pulsing animation
const RadiusOscillationSize = 0;
const RadiusOscillationDuration = 1 / 2; // seconds

// Arc gap animation
const GapBase = 1 / 12; // in pct of full circle
const GapOscillationDuration = 1; // seconds

// Winner circle animation
const WinnerAnimationDuration = 1; // seconds
const MaskCircleDiameter = 320;

// Deleted participant animation
const DeletedParticipantAnimationDuration = 0.1; // seconds

const getRadius = (diff, base) => {
  if (diff < GrowAnimationDuration) {
    return (base * diff) / GrowAnimationDuration;
  }
  const oscillation =
    RadiusOscillationSize *
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

    ctx.fillStyle = "#212121";
    ctx.beginPath();
    ctx.arc(
      x,
      y,
      Math.max(1 - winnerDiff / WinnerAnimationDuration, 0) *
        Math.min(canvas.width, canvas.height) +
        MaskCircleDiameter / 2,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  // Inner circle
  const innerCircleRadius = getRadius(diff, InnerCircleDiameter / 2);
  ctx.fillStyle = colour;
  ctx.strokeStyle = undefined;
  ctx.lineWidth = undefined;
  ctx.beginPath();
  ctx.arc(x, y, innerCircleRadius, 0, 2 * Math.PI);
  ctx.fill();

  // Outer circle
  const outerCircleRadius = getRadius(diff, OuterCircleDiameter / 2);
  const outerCircleArc = getArc(diff);
  ctx.fillStyle = undefined;
  ctx.strokeStyle = colour;
  ctx.lineWidth = OuterCircleThickness;
  ctx.beginPath();
  ctx.arc(x, y, outerCircleRadius, outerCircleArc.start, outerCircleArc.end);
  ctx.stroke();
};

const drawDeletedParticipant = ({ ctx, participant, frame }) => {
  const { x, y, colour, startFrame, deletedFrame } = participant;
  const diffWhenDeleted = (deletedFrame - startFrame) / window.fps;
  const diffToStart = (frame - startFrame) / window.fps;
  const diffToDeleted = (frame - deletedFrame) / window.fps;

  // Inner circle
  const innerCircleRadiusWhenDeleted = getRadius(
    diffWhenDeleted,
    InnerCircleDiameter / 2
  );
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
  const outerCircleRadiusWhenDeleted = getRadius(
    diffWhenDeleted,
    OuterCircleDiameter / 2
  );
  const outerCircleRadius =
    (1 - diffToDeleted / DeletedParticipantAnimationDuration) *
    outerCircleRadiusWhenDeleted;
  const outerCircleArc = getArc(diffToStart);
  ctx.fillStyle = undefined;
  ctx.strokeStyle = colour;
  ctx.lineWidth = OuterCircleThickness;
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
      drawParticipant({ canvas, ctx, participant, frame });
    });
    deletedParticipantsList.forEach((deletedParticipants) => {
      drawDeletedParticipant({ ctx, participant: deletedParticipants, frame });
    });
  };
}

const MaxTouchPoints = Math.min(Math.max(navigator.maxTouchPoints, 1), 10);
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
    this.canvas.addEventListener("pointerdown", this.addParticipant);
    this.canvas.addEventListener("pointermove", this.moveParticipant);
    this.canvas.addEventListener("pointerup", this.removeParticipant);

    this.canvas.addEventListener("contextmenu", (event) =>
      event.preventDefault()
    );
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
      const winnerIndex = Math.floor(
        Math.random() * Object.values(this.participants).length
      );
      const winner = ids[winnerIndex];
      ids.forEach((id) => {
        if (id === winner) {
          this.participants[id].winner = true;
          this.participants[id].winnerFrame = this.renderer.frame;
        } else {
          this.removeParticipant({ pointerId: id });
        }
      });
    }, TimeUntilPick * 1000);
  };

  addParticipant = (event) => {
    const { pointerId: id, clientX: x, clientY: y } = event;
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
    this.participants[id] = { x, y, colour, startFrame: frame };
    this.resetChooseTimer();
    event.preventDefault?.();
  };

  moveParticipant = (event) => {
    const { pointerId: id, clientX: x, clientY: y } = event;
    if (this.participants[id] === undefined) {
      return;
    }
    this.participants[id].x = x;
    this.participants[id].y = y;
    event.preventDefault?.();
  };

  removeParticipant = (event) => {
    const { pointerId: id } = event;
    if (this.participants[id] === undefined) {
      return;
    }
    colours.cedeColour(this.participants[id].colour);
    delete this.participants[id];
    this.resetChooseTimer();
    event.preventDefault?.();
  };
}

const canvas = document.getElementById("main");
new Picker(canvas);
