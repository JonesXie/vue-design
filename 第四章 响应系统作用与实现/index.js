let bucket = new Set();

let data = {
  text: "hello world",
};

// proxy 地址：https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Proxy

let obj = new Proxy(data, {
  // 获取属性
  get(target, key) {
    bucket.add(effect);
    return target[key];
  },
  // 设置属性
  set(target, key, value) {
    target[key] = value;
    bucket.forEach((fn) => fn());
    return true; // 返回 true 则设置成功
  },
});

function effect() {
  document.body.innerHTML = obj.text;
}

effect();

setTimeout(() => {
  obj.text = "hello world2";
}, 1000);
