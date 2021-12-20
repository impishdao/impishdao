import { BigNumber, ethers } from "ethers";

export function secondsToDhms(seconds: number) {
  seconds = Number(seconds);
  var d = Math.floor(seconds / (3600 * 24));
  var h = Math.floor((seconds % (3600 * 24)) / 3600);
  var m = Math.floor((seconds % 3600) / 60);
  var s = Math.floor(seconds % 60);

  var dDisplay = d > 0 ? d + (d === 1 ? " day, " : " days, ") : "";
  var hDisplay = h > 0 ? h + (h === 1 ? " hour, " : " hours, ") : "";
  var mDisplay = m > 0 ? m + (m === 1 ? " minute, " : " minutes, ") : "";
  var sDisplay = s + (s === 1 ? " second" : " seconds");
  return dDisplay + hDisplay + mDisplay + sDisplay;
}

export function format4Decimals(n?: BigNumber): string {
  if (n === undefined) {
    return "-";
  }
  return parseFloat(ethers.utils.formatEther(n)).toFixed(4);
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
