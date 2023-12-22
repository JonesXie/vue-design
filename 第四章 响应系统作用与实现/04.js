let bucket = new WeakMap(); // 使用 WeakMap 创建一个新映射 bucket
let activeEffect; // 创建一个变量 activeEffect，用于存储当前活动的副作用函数
// 新增
let effectStack = []; // 创建一个新数组 effectStack，用于存储副作用函数的调用栈

let data = {
  ok: true,
  text: "hello world",
}; // 创建一个对象 data，包含两个属性 ok 和 text

let obj = new Proxy(data, {
  // 使用 Proxy 构造一个新的对象 obj，它的 handler 为一个对象
  get(target, key) {
    track(target, key); // 调用 track 函数，记录获取属性的关键路径

    return target[key]; // 返回目标对象属性的值
  },

  set(target, key, value) {
    target[key] = value; // 设置目标对象属性的值

    trigger(target, key); // 调用 trigger 函数，记录修改属性的关键路径
  },
});

const track = function (target, key) {
  // 定义一个名为 track 的函数
  if (!activeEffect) return target[key]; // 如果没有活动的副作用函数则返回目标属性的值
  let depsMap = bucket.get(target); // 获取目标对象对应的依赖关系映射
  if (!depsMap) {
    bucket.set(target, (depsMap = new Map())); // 如果没有依赖关系映射则创建一个新的依赖关系映射，并将其存储在目标对象对应的映射中
  }
  let deps = depsMap.get(key); // 获取目标属性的依赖关系集合
  if (!deps) {
    depsMap.set(key, (deps = new Set())); // 如果没有依赖关系集合则创建一个新的依赖关系集合，并将其存储在目标属性对应的映射中
  }

  deps.add(activeEffect); // 将当前活动的副作用函数添加到目标属性的依赖关系集合中

  activeEffect.deps.push(deps); // 将目标属性的依赖关系集合添加到当前活动的副作用函数的依赖列表中
};

const trigger = function (target, key) {
  // 定义一个名为 trigger 的函数
  const depsMap = bucket.get(target); // 获取目标对象对应的依赖关系映射
  if (!depsMap) return true; // 如果没有依赖关系映射则返回 true

  const effects = depsMap.get(key); // 获取目标属性的副作用函数集合

  const effectsToRun = new Set(effects); // 创建一个新的副作用函数集合，用于存储需要执行的副作用函数
  effectsToRun.forEach((fn) => fn()); // 遍历需要执行的副作用函数集合，并依次执行每个副作用函数
};

const cleanup = (effectFn) => {
  // 定义一个名为 cleanup 的函数
  for (let i = 0; i < effectFn.deps.length; i++) {
    // 循环遍历当前副作用函数的依赖列表
    const deps = effectFn.deps[i]; // 获取当前副作用函数的依赖关系集合

    deps.delete(effectFn); // 从依赖关系集合中删除当前副作用函数
  }
  effectFn.deps.length = 0; // 清空当前副作用函数的依赖列表
};

function effect(fn) {
  // 定义一个名为 effect 的函数
  const effectFn = () => {
    // 创建一个新的函数 effectFn
    cleanup(effectFn); // 在副作用函数执行完毕后进行清理操作
    activeEffect = effectFn; // 将当前副作用函数设置为活动的副作用函数
    // 在调用副作用函数之前将当前副作用函数压入栈中
    effectStack.push(effectFn); // 新增
    fn(); // 执行副作用函数
    // 在当前副作用函数执行完毕后，将当前副作用函数弹出栈，并把 activeEffect 还原为之前的值
    effectStack.pop(); // 新增
    activeEffect = effectStack[effectStack.length - 1]; // 新增
  };

  effectFn.deps = []; // 初始化当前副作用函数的依赖列表

  effectFn(); // 执行当前副作用函数
}

effect(() => {
  // 使用 effect 函数包裹一个匿名函数
  console.log("run effect1"); // 打印 "run effect1"

  effect(() => {
    // 使用 effect 函数包裹一个匿名函数
    console.log("run effect2"); // 打印 "run effect2"
    document.body.innerHTML = obj.text; // 将 obj 对象的 text 属性的值赋给 document.body 的 innerHTML 属性
  });
  document.body.innerHTML = obj.ok; // 将 obj 对象的 ok 属性的值赋给 document.body 的 innerHTML 属性
});
