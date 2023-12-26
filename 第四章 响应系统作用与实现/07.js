let bucket = new WeakMap();
let activeEffect;

let effectStack = [];

let data = {
  ok: true,
  text: "hello world",
  count: 0,
  a: 1,
  b: 2,
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
  // 之前这里都为错误的，会形成死循环
  if (!activeEffect) return;

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

function effect(fn, options = {}) {
  const effectFn = () => {
    cleanup(effectFn);
    activeEffect = effectFn;

    effectStack.push(effectFn);

    let res = fn();

    effectStack.pop();
    activeEffect = effectStack[effectStack.length - 1];

    return res;
  };

  effectFn.options = options; // 保存 opinions

  effectFn.deps = [];
  if (!options.lazy) {
    effectFn();
  }
  return effectFn;
}

const computed = (fn) => {
  let value;
  let dirty = true;
  const effectFn = effect(fn, {
    lazy: true,
    scheduler: () => {
      if (!dirty) {
        dirty = true;
        trigger(obj, "value");
      }
    },
  });

  let obj = {
    get value() {
      if (dirty) {
        value = effectFn();
        dirty = false;
      }
      track(obj, "value");
      return value;
    },
  };
  return obj;
};

const computedValue = computed(() => obj.a + obj.b);

// 案例一
console.log(computedValue.value);
console.log(computedValue.value);

obj.a = 2;

console.log(computedValue.value);

//案例二;
effect(() => {
  console.log("effect 嵌套内", computedValue.value);
});

obj.b = 3;
