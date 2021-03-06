import { BigNumber, Contract } from "ethers";
import ImpishDAOConfig from "./impishdao-config.json";
import { Web3Provider } from "@ethersproject/providers";
import { MultiTxItem } from "./components/walletutils";

import type { RandomWalkNFT } from "../../typechain/RandomWalkNFT";
import type { ImpishSpiral } from "../../typechain/ImpishSpiral";
import type { ImpishCrystal } from "../../typechain/ImpishCrystal";
import type { SpiralBits } from "../../typechain/SpiralBits";
import type { StakingV2 } from "../../typechain/StakingV2";
import type { ImpishDAO } from "../../typechain/ImpishDAO";
import type { SpiralStaking } from "../../typechain/SpiralStaking";
import type { RWNFTStaking } from "../../typechain/RWNFTStaking";
import type { BuyWithEther } from "../../typechain/BuyWithEther";
import type { MultiMint } from "../../typechain/MultiMint";
import type { RPS } from "../../typechain/RPS";
import type { ERC20 } from "../../typechain/ERC20";

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

export type MultiTxModalState = {
  show: boolean;
  txns: MultiTxItem[];
  resolve?: (value: boolean) => void;
  reject?: (reason: any) => void;
};

export class DappState {
  networkError?: string;
  lastETHPrice?: number;

  // User specific state
  impishTokenBalance: BigNumber;
  spiralBitsBalance: BigNumber;
  ethBalance: BigNumber;
  magicBalance: BigNumber;
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

  // All the contracts
  contracts?: DappContracts;

  // State of Modals
  multiTxModal: MultiTxModalState;

  constructor() {
    this.impishTokenBalance = BigNumber.from(0);
    this.spiralBitsBalance = BigNumber.from(0);
    this.ethBalance = BigNumber.from(0);
    this.magicBalance = BigNumber.from(0);
    this.modalShowing = false;

    this.areWeWinning = false;
    this.isRoundFinished = false;

    this.impishTokenBalance = BigNumber.from(0);
    this.nftsWithPrice = [];
    this.currentToasts = [];

    this.multiTxModal = { show: false, txns: [] };
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
  waitForTxConfirmation: (tx: Promise<any>, title?: string) => Promise<boolean>;
  executeMultiTx: (txns: MultiTxItem[]) => Promise<boolean>;
};

export type DappContracts = {
  provider: Web3Provider;

  rwnft: RandomWalkNFT;
  impdao: ImpishDAO;
  impspiral: ImpishSpiral;
  spiralmarket: Contract;
  multimint: MultiMint;
  spiralbits: SpiralBits;
  spiralstaking: SpiralStaking;
  rwnftstaking: RWNFTStaking;
  buywitheth: BuyWithEther;
  crystal: ImpishCrystal;
  stakingv2: StakingV2;
  rps: RPS;
  magic: ERC20;
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
  indirectOwner?: string;
};

type NFTtype = "RandomWalkNFT" | "Spiral" | "GrowingCrystal" | "Crystal";

export class NFTCardInfo {
  tokenId: number;
  image: string;
  contractIdMultiplier: number;
  metadata: BigNumber | SpiralDetail | CrystalInfo;
  progress?: number;

  constructor(
    tokenId: number,
    contractIdMultiplier: number,
    image: string,
    metadata: BigNumber | SpiralDetail | CrystalInfo
  ) {
    this.tokenId = tokenId;
    this.image = image;
    this.contractIdMultiplier = contractIdMultiplier;
    this.metadata = metadata;
  }

  getContractTokenId(): number {
    return this.tokenId + this.contractIdMultiplier;
  }

  static NFTTypeFromContractTokenId = (contractTokenId: BigNumber | number): NFTtype => {
    if (typeof contractTokenId === "number") {
      contractTokenId = BigNumber.from(contractTokenId);
    }

    const contractId = NFTCardInfo.SplitFromContractTokenId(contractTokenId)[1];
    return NFTCardInfo.NFTTypeForContractMultiplier(contractId.toNumber());
  };

  static SplitFromContractTokenId = (contractTokenId: BigNumber): [BigNumber, BigNumber] => {
    const contractMultiplier = contractTokenId.div(1000000).mul(1000000);
    const tokenId = contractTokenId.sub(contractMultiplier);

    return [tokenId, contractMultiplier];
  };

  static NFTTypeForContractMultiplier = (contractId: number): NFTtype => {
    switch (contractId) {
      case 1000000:
        return "RandomWalkNFT";
      case 2000000:
        return "Spiral";
      case 3000000:
        return "GrowingCrystal";
      case 4000000:
        return "Crystal";
    }

    throw new Error("Unrecognized ContractIDMultiplier");
  };

  getNFTtype(): NFTtype {
    return NFTCardInfo.NFTTypeForContractMultiplier(this.contractIdMultiplier);
  }

  getNFTTypeShort(): string {
    switch (this.contractIdMultiplier) {
      case 1000000:
        return "RW";
      case 2000000:
        return "Spiral";
      case 3000000:
        return "Crystal";
      case 4000000:
        return "Crystal";
    }

    throw new Error("Unrecognized ContractIDMultiplier");
  }
}
