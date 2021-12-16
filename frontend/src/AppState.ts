import { BigNumber } from "ethers";
import ImpishDAOConfig from "./impishdao-config.json";

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

export class DappState {
  networkError?: string;
  lastETHPrice?: number;

  // User specific state
  tokenBalance: BigNumber;
  selectedAddress?: string;

  modalTitle?: string;
  modalMessage?: JSX.Element;
  modalShowing: boolean;

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

  constructor() {
    this.tokenBalance = BigNumber.from(0);
    this.modalShowing = false;

    this.areWeWinning = false;
    this.isRoundFinished = false;

    this.tokenBalance = BigNumber.from(0);
    this.nftsWithPrice = [];
  }
}