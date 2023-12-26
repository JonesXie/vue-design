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

const watch = (source, cb, options = {}) => {
  let getter;

  if (typeof source === "function") {
    getter = source;
  } else {
    // 调用 traverse 递归地读取
    getter = () => traverse(source);
  }

  // 定义旧值与新值
  let oldValue, newValue;

  // cleanup 用来存储用户注册的过期回调
  let cleanup;
  // 定义 onInvalidate 函数
  function onInvalidate(fn) {
    // 将过期回调存储到 cleanup 中
    cleanup = fn;
  }

  // 将 schedule 执行的函数 提取成一个 job 函数
  const job = () => {
    // 在 scheduler 中重新执行副作用函数，得到的是新值
    newValue = effectFn();
    // 在调用回调函数 cb 之前，先调用过期回调
    if (cleanup) {
      cleanup();
    }
    // 将旧值和新值作为回调函数的参数, 添加 onInvalidate
    cb(newValue, oldValue, onInvalidate);
    // 更新旧值，不然下一次会得到错误的旧值
    oldValue = newValue;
  };

  const effectFn = effect(
    // 触发读取操作，从而建立联系
    () => getter(),
    {
      lazy: true, // 延迟执行
      scheduler: () => {
        // 在调度函数中判断 flush 是否为 'post'，如果是，将其放到微任务队列中执行
        if (options.flush === "post") {
          const p = Promise.resolve();
          p.then(job);
        } else {
          job();
        }
      },
    }
  );
  if (options.immediate) {
    // 当 immediate 为 true 时立即执行 job，从而触发回调执行
    job();
  } else {
    // 手动调佣 effectFn
    oldValue = effectFn();
  }
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

// 接收到的数据
let fetchData;

watch(
  // 传的是 getter 函数
  () => obj.b,
  async (newValue, oldValue, onInvalidate) => {
    let expire = false;

    onInvalidate(() => {
      expire = true;
    });

    const res = await fetch("/api/get/data");

    if (!expire) {
      // 赋值
      fetchData = res;
    } else {
      // 过期就不赋值了
      console.log("过期了");
    }
  },
  {
    // immediate: true，
    // 回调函数会在 watch 创建时立即执行一次
    flush: "pre", // 还可以指定为 'post' | 'sync'
  }
);

obj.b++; // 修改 obj.b 的值
