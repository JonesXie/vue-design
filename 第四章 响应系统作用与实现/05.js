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
      // 在同一个effect 副作用函数中，不会
      if (effectFn !== activeEffect) {
        effectsToRun.add(effectFn);
      }
    });
  // 修改
  effectsToRun.forEach((fn) => fn());
};

const cleanup = (effectFn) => {
  for (let i = 0; i < effectFn.deps.length; i++) {
    const deps = effectFn.deps[i];

    deps.delete(effectFn);
  }
  effectFn.deps.length = 0;
};

function effect(fn) {
  const effectFn = () => {
    cleanup(effectFn);
    activeEffect = effectFn;

    effectStack.push(effectFn);
    fn();

    effectStack.pop();
    activeEffect = effectStack[effectStack.length - 1];
  };

  effectFn.deps = [];

  effectFn();
}

effect(() => {
  console.log("run effect");
  obj.count++;
  document.body.innerHTML = obj.count; // 自增---自己又读又写自己
});
