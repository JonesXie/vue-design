let bucket = new WeakMap();
let activeEffect;

let effectStack = [];

let data = {
  ok: true,
  text: "hello world",
  count: 0,
};

let obj = new Proxy(data, {
  get(target, key) {
    track(target, key);

    return target[key];
  },

  set(target, key, value) {
    target[key] = value;

    trigger(target, key);
  },
});

const track = function (target, key) {
  if (!activeEffect) return target[key];
  let depsMap = bucket.get(target);
  if (!depsMap) {
    bucket.set(target, (depsMap = new Map()));
  }
  let deps = depsMap.get(key);
  if (!deps) {
    depsMap.set(key, (deps = new Set()));
  }

  deps.add(activeEffect);

  activeEffect.deps.push(deps);
};

const trigger = function (target, key) {
  const depsMap = bucket.get(target);
  if (!depsMap) return true;

  const effects = depsMap.get(key);

  const effectsToRun = new Set();

  effects &&
    effects.forEach((effectFn) => {
      if (effectFn !== activeEffect) {
        effectsToRun.add(effectFn);
      }
    });

  effectsToRun.forEach((fn) => {
    if (fn.options.scheduler) {
      // 有调度器时，将 副作用函数 传给调度器，由调度器函数自行决定执行时机
      fn.options.scheduler(fn);
    } else {
      // 没有调度器时，自行执行
      fn();
    }
  });
};

const cleanup = (effectFn) => {
  for (let i = 0; i < effectFn.deps.length; i++) {
    const deps = effectFn.deps[i];

    deps.delete(effectFn);
  }
  effectFn.deps.length = 0;
};

function effect(fn, options) {
  const effectFn = () => {
    cleanup(effectFn);
    activeEffect = effectFn;

    effectStack.push(effectFn);
    fn();

    effectStack.pop();
    activeEffect = effectStack[effectStack.length - 1];
  };

  effectFn.options = options; // 保存 opinions

  effectFn.deps = [];

  effectFn();
}

effect(
  () => {
    console.log("run effect");
    console.log(obj.count);
  },
  // 添加一个 options 参数,里面有 scheduler 属性
  {
    scheduler: (fn) => {
      setTimeout(fn, 0); // 异步执行
    },
  }
);

obj.count++;

console.log("结束了");
