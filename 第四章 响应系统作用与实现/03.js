let bucket = new WeakMap(); // 创建一个 WeakMap 对象 bucket
let activeEffect; // 创建一个变量 activeEffect

let data = {
  ok: true, // 新增
  text: "hello world",
};

let obj = new Proxy(data, {
  // 使用 Proxy 构造函数创建一个新的对象 obj，并传入 data 和一个包含 get 和 set 方法的对象作为第二个参数
  get(target, key) {
    track(target, key); // 调用 track 方法

    return target[key]; // 返回 target[key]
  },

  set(target, key, value) {
    target[key] = value; // 修改 target[key] 的值

    trigger(target, key); // 调用 trigger 方法
  },
});

// 定义 track 方法
const track = function (target, key) {
  if (!activeEffect) return target[key]; // 如果 activeEffect 为 undefined 或 null，则返回 target[key]
  let depsMap = bucket.get(target); // 获取 target 对应的依赖映射
  if (!depsMap) {
    bucket.set(target, (depsMap = new Map())); // 如果没有依赖映射，则创建一个新的依赖映射并将其设置到 bucket 中
  }
  let deps = depsMap.get(key); // 获取 key 对应的依赖集合
  if (!deps) {
    depsMap.set(key, (deps = new Set())); // 如果没有依赖集合，则创建一个新的依赖集合并将其设置到依赖映射中
  }

  // 将当前激活的副作用函数添加到依赖集合 deps 中
  deps.add(activeEffect);
  // 将 deps 添加到 activeEffect.deps 数组中
  activeEffect.deps.push(deps); // 新增
};

// 定义 trigger 方法
const trigger = function (target, key) {
  const depsMap = bucket.get(target); // 获取 target 对应的依赖映射
  if (!depsMap) return true; // 如果没有依赖映射，则直接返回 true
  const effects = depsMap.get(key); // 获取当前的依赖集合
  // 创建一个新的依赖集合 effectsToRun，并将当前的依赖集合 effects 添加到其中
  const effectsToRun = new Set(effects);
  effectsToRun.forEach((fn) => fn()); // 遍历 effectsToRun 中的每个函数，并执行它，即每个 fn 为 effectFn
  // 对于每个依赖集合，删除其中的当前副作用函数
  // deps && deps.forEach((fn) => fn());
};

const cleanup = (effectFn) => {
  for (let i = 0; i < effectFn.deps.length; i++) {
    const deps = effectFn.deps[i];
    // 删除依赖集合中的当前副作用函数
    deps.delete(effectFn);
  }
  effectFn.deps.length = 0; // 清空 effectFn.deps 数组
};

// 定义 effect 方法
function effect(fn) {
  // 将当前激活的副作用函数设置为 effectFn
  const effectFn = () => {
    cleanup(effectFn); // 清理副作用函数 effectFn
    activeEffect = effectFn;
    fn(); // 执行副作用函数的回调函数 fn
  };
  // activeEffect.deps 用来存储所有与该副作用函数相关联的依赖集合
  effectFn.deps = [];

  effectFn(); // 执行 effectFn，即执行副作用函数
}

effect(() => {
  console.log("run"); // 输出 "run"
  document.body.innerHTML = obj.ok ? obj.text : "error"; // 修改 body 内容为 obj.ok ? obj.text : "error"
  // document.body.innerHTML = obj.text; // 修改 body 内容为 obj.text
});

// 改变数据，产生响应
setTimeout(() => {
  obj.ok = false; // 将 obj.ok 设置为 false
}, 1000);

// 避免因修改 obj.text 导致重复执行
setTimeout(() => {
  console.log("hello change"); // 输出 "hello change"
  obj.text = "hello"; // 将 obj.text 设置为 "hello"
}, 2000);
