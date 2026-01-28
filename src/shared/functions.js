export const waitTime = async timeout => new Promise(resolve => setTimeout(resolve, timeout));
export const waitCondition = async ({ Condition = () => true, timeout = 500, totalWatingTime = 30000 }) => new Promise(resolve => {
  const startTime = new Date().getTime() / 1000;
  const timer = setInterval(() => {
    const nowTime = new Date().getTime() / 1000;
    if(Condition() || nowTime - startTime > totalWatingTime) {
      clearInterval(timer);
      resolve();
    }
  }, timeout);
})