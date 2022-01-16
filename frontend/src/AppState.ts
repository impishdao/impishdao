import { BigNumber, Contract } from "ethers";
import ImpishDAOConfig from "./impishdao-config.json";
import { Web3Provider } from "@ethersproject/providers";

export const ARBITRUM_NETWORK_ID = "42161";

export const WANTED_NETWORK_ID = ImpishDAOConfig.NetworkID || ARBITRUM_NETWORK_ID;

// This is an error code that indicates that the user canceled a transaction
export const ERROR_CODE_TX_REJECTED_BY_USER = 4001;

export class NFTForSale {
  tokenId: BigNumber;
  price: BigNumber;

  constructor(_tokenID: BigNumber, _price: BigNumber) {
    this.tokenId = _tokenID;
    this.price = _price;
  }
}

export type ToastInfo = {
  id: number;
  title: string;
  body: JSX.Element;
  autohide: boolean;
  show: boolean;
};

export class DappState {
  networkError?: string;
  lastETHPrice?: number;

  // User specific state
  impishTokenBalance: BigNumber;
  spiralBitsBalance: BigNumber;
  ethBalance: BigNumber;
  selectedAddress?: string;

  modalTitle?: string;
  modalMessage?: JSX.Element;
  modalShowing: boolean;
  modalCloseCallBack?: () => void;

  // DAO State
  areWeWinning: boolean;
  contractState?: number;
  daoBalance?: BigNumber;
  totalTokenSupply?: BigNumber;

  // RwNFT State
  isRoundFinished: boolean;
  mintPrice?: BigNumber;
  lastMintTime?: BigNumber;
  withdrawalAmount?: BigNumber;

  // List of NFTs for sale by the DAO
  nftsWithPrice: Array<NFTForSale>;

  // Toasts currently Displaying
  currentToasts: Array<ToastInfo>;

  constructor() {
    this.impishTokenBalance = BigNumber.from(0);
    this.spiralBitsBalance = BigNumber.from(0);
    this.ethBalance = BigNumber.from(0);
    this.modalShowing = false;

    this.areWeWinning = false;
    this.isRoundFinished = false;

    this.impishTokenBalance = BigNumber.from(0);
    this.nftsWithPrice = [];
    this.currentToasts = [];
  }
}

export type SpiralsState = {
  lastMintTime: BigNumber;
  nextTokenId: BigNumber;
  totalReward: BigNumber;
};

export type DappFunctions = {
  connectWallet: () => void;
  readDappState: () => Promise<void>;
  readUserData: () => Promise<void>;
  showModal: (title: string, message: JSX.Element, modalCloseCallBack?: () => void) => void;
  waitForTxConfirmation: (tx: Promise<any>, title?: string) => Promise<void>;
};

export type DappContracts = {
  provider?: Web3Provider;

  rwnft?: Contract;
  impdao?: Contract;
  impspiral?: Contract;
  spiralmarket?: Contract;
  multimint?: Contract;
  spiralbits?: Contract;
  spiralstaking?: Contract;
  rwnftstaking?: Contract;
  buywitheth?: Contract;
  crystal?: Contract;
};


export type SpiralDetail = {
  tokenId: BigNumber;
  seed: string;
  owner: string;
  indirectOwner?: string;
};


export type CrystalInfo = {
  tokenId: BigNumber;
  size: number;
  generation: number;
  sym: number;
  seed: BigNumber;
  spiralBitsStored: BigNumber;
  owner: string;
};
