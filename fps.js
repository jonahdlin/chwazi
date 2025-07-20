let times = [];
let recentFps = [];
let fps = 60;

const FpsSampled = 20;
const FpsTolerance = 2;

const avg = (arr) => arr.reduce((acc, v) => acc + v, 0) / arr.length;

const calculateFPS = () => {
  const sampleFPS = (timestamp) => {
    while (times.length > 0 && times[0] <= timestamp - 1000) {
      times.shift();
    }
    times.push(timestamp);
    fps = times.length;

    if (
      recentFps.length >= FpsSampled &&
      Math.abs(fps - avg(recentFps.slice(-FpsSampled))) <= FpsTolerance
    ) {
      window.fps = fps;
      return;
    }

    recentFps.push(fps);
    if (fps >= window.fps) {
      window.fps = fps;
    }

    requestAnimationFrame(sampleFPS);
  };

  requestAnimationFrame(sampleFPS);
};

calculateFPS();
window.fps = 60;
