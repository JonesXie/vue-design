// target 为原始对象，key 为属性名，effectFn 为副作用函数
/**
 * - target1
 *    - key
 *      - effectFn
 *      - effectFn2
 * - target2
 *    - key
 *      - effectFn
 *      - effectFn2
 */
let bucket = new WeakMap(); // 创建一个WeakMap，用于存储对象和其依赖关系的映射
let activeEffect; // 记录当前激活的副作用函数

let data = {
  text: "hello world", // 原始对象data，包含一个text属性
};

// proxy 地址：https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Proxy

let obj = new Proxy(data, {
  // 使用Proxy代理data对象
  // 获取属性
  get(target, key) {
    track(target, key); // 调用track函数记录依赖关系

    return target[key]; // 返回目标对象的属性值
  },
  // 设置属性
  set(target, key, value) {
    target[key] = value; // 设置目标对象的属性值

    trigger(target, key); // 调用trigger函数触发副作用
  },
});

const track = function (target, key) {
  // track函数记录依赖关系
  if (!activeEffect) return target[key]; // 如果没有激活的副作用函数则直接返回属性值
  let depsMap = bucket.get(target); // 获取目标对象的依赖关系映射
  if (!depsMap) {
    bucket.set(target, (depsMap = new Map())); // 如果没有依赖关系映射，则创建一个新的Map并设置到bucket中
  }
  let deps = depsMap.get(key); // 获取目标对象的属性的依赖集合
  if (!deps) {
    depsMap.set(key, (deps = new Set())); // 如果没有依赖集合，则创建一个新的Set并设置到依赖关系映射中
  }
  deps.add(activeEffect); // 将激活的副作用函数添加到依赖集合中
};

const trigger = function (target, key) {
  // trigger函数触发副作用
  const depsMap = bucket.get(target); // 获取目标对象的依赖关系映射
  if (!depsMap) return true; // 如果没有依赖关系映射，则直接返回true
  const deps = depsMap.get(key); // 获取目标对象的属性的依赖集合
  deps && deps.forEach((fn) => fn()); // 遍历依赖集合并执行副作用函数
};

function effect(fn) {
  // effect函数设置并执行副作用函数
  activeEffect = fn; // 设置激活的副作用函数
  fn && fn(); // 执行副作用函数
}

effect(() => {
  console.log("run"); // 输出"run"
  document.body.innerHTML = obj.text; // 将obj的text属性值赋值给document.body的innerHTML属性
});

setTimeout(() => {
  obj.text = "hello world2"; // 修改obj的text属性值为"hello world2"
  obj.noExit = "222"; // 添加新的属性noExit到obj对象中
}, 1000);
