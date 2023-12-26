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

const watch = (source, cb) => {
  let getter;

  if (typeof source === "function") {
    getter = source;
  } else {
    // 调用 traverse 递归地读取
    getter = () => traverse(source);
  }

  // 定义旧值与新值
  let oldValue, newValue;
  // 使用 effect 注册副作用函数时，开启 lazy 选项，并把返回值存储到 effectFn 中以便后续手动调用

  const effectFn = effect(
    // 触发读取操作，从而建立联系
    () => getter(),
    {
      lazy: true, // 延迟执行
      scheduler: () => {
        // 在 scheduler 中重新执行副作用函数，得到的是新值
        newValue = effectFn();
        // 将旧值和新值作为回调函数的参数
        cb(newValue, oldValue);
        // 更新旧值，不然下一次会得到错误的旧值
        oldValue = newValue;
      },
    }
  );

  // 手动调佣 effectFn
  oldValue = effectFn();
};

const traverse = (value, seen = new Set()) => {
  // 如果要读取的数据是原始值，或者已经被读取过了，那么什么都不做
  if (typeof value !== "object" || value === null || seen.has(value)) {
    return;
  }
  // 将数据添加到 seen 中，代表遍历地读取过了，避免循环引用引起的死循环

  seen.add(value);

  // 暂时不考虑数组等其他结构
  // 假设 value 就是一个对象，使用 for...in 读取对象的每一个值，并递归地调用 traverse 进行处理

  for (let key in value) {
    // 读取了 value[key], 将依赖收集起来
    traverse(value[key], seen);
  }

  return value;
};

// 案例一  监听全部属性
watch(obj, () => {
  console.log("监听到数据改变");
});

obj.count++;

// 案例二   监听 a 属性
watch(
  // 传的是 getter 函数
  () => obj.a,
  () => {
    console.log("监听到数据改变2");
  }
);

obj.a++;

// 案例三   监听 b 属性, 获取到 oldValue 和 newValue
watch(
  // 传的是 getter 函数
  () => obj.b,
  (newValue, oldValue) => {
    console.log("监听到数据改变3", newValue, oldValue);
  }
);

obj.b++;
