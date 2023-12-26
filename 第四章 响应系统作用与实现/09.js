let bucket = new WeakMap(); // 创建一个 WeakMap，用于存储依赖关系
let activeEffect; // 指向当前激活的副作用函数

let effectStack = []; // 创建一个数组，用于存储副作用函数的依赖列表

let data = {
  ok: true,
  text: "hello world",
  count: 0,
  a: 1,
  b: 2,
}; // 创建一个数据对象

let obj = new Proxy(data, {
  // 使用 Proxy 创建一个包装后的对象，用于追踪属性的读写操作
  get(target, key) {
    track(target, key); // 调用 track 方法记录依赖关系

    return target[key]; // 返回属性的值
  },
  set(target, key, value) {
    target[key] = value; // 设置属性的值

    trigger(target, key); // 调用 trigger 方法触发副作用函数
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
  // 使用 effect 注册副作用函数时，开启 lazy 选项，并把返回值存储到 effectFn 中以便后续手动调用

  // 将 schedule 执行的函数 提取成一个 job 函数
  const job = () => {
    // 在 scheduler 中重新执行副作用函数，得到的是新值
    newValue = effectFn();
    // 将旧值和新值作为回调函数的参数
    cb(newValue, oldValue);
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

watch(
  // 传的是 getter 函数
  () => obj.b,
  (newValue, oldValue) => {
    console.log("监听到数据改变3", newValue, oldValue);
  },
  {
    // immediate: true，
    // 回调函数会在 watch 创建时立即执行一次
    flush: "pre", // 还可以指定为 'post' | 'sync'
  }
);

obj.b++; // 修改 obj.b 的值
