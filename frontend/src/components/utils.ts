import { BigNumber, ethers } from "ethers";

export function secondsToDhms(seconds: number, includeSeconds?: boolean) {
  seconds = Number(seconds);
  var d = Math.floor(seconds / (3600 * 24));
  var h = Math.floor((seconds % (3600 * 24)) / 3600);
  var m = Math.floor((seconds % 3600) / 60);
  var s = Math.floor(seconds % 60);

  var dDisplay = d > 0 ? d + (d === 1 ? " day, " : " days, ") : "";
  var hDisplay = h > 0 ? h + (h === 1 ? " hour, " : " hours, ") : "";
  var mDisplay = m > 0 ? m + (m === 1 ? " minute" : " minutes ") : "";

  var sDisplay = "";
  if (includeSeconds) {
    sDisplay = s + (s === 1 ? ", second" : ", seconds");
  }
  return dDisplay + hDisplay + mDisplay + sDisplay;
}

export function format4Decimals(n?: BigNumber): string {
  if (n === undefined) {
    return "-";
  }
  return parseFloat(ethers.utils.formatEther(n)).toFixed(4);
}

export function formatkmb(n?: BigNumber): string {
  if (n === undefined) {
    return "-";
  }

  let num = parseFloat(ethers.utils.formatEther(n));
  let suffix = "";
  if (num > 1000) {
    num /= 1000;
    suffix = "K";
  }

  if (num > 1000) {
    num /= 1000;
    suffix = "M";
  }

  if (num > 1000) {
    num /= 1000;
    suffix = "B";
  }

  return `${num.toFixed(2)}${suffix}`;
}

export function formatUSD(bal: BigNumber, lastETHPrice?: number) {
  if (lastETHPrice === undefined || !lastETHPrice) {
    return "(USD -)";
  }

  return "(USD " + (parseFloat(ethers.utils.formatEther(bal)) * lastETHPrice).toFixed(2) + ")";
}

export function pad(num: string, size: number): string {
  var s = "000000000" + num;
  return s.substr(s.length - size);
}

export function range(len: number, startAt: number = 0) {
  return Array.from(Array(len).keys()).map((i) => i + startAt);
}

export function trimAddress(address: string): string {
  if (!address || address.length < 10) {
    return address;
  }

  return address.substring(0, 7) + "..." + address.substring(address.length - 5, address.length);
}

export function retryTillSucceed(fn: () => Promise<void>, ctr?: number) {
  if (ctr && ctr > 10) {
    console.log("Giving up after 10 tries");
    return;
  }

  (async () => {
    try {
      await fn();
      // If it succeeds, return
      return;
    } catch (e) {
      console.log(JSON.stringify(e));
      setTimeout(() => retryTillSucceed(fn), 1000 * 2, (ctr || 0) + 1);
    }
  })();
}

export const THREE_DAYS = 3 * 24 * 3600;
