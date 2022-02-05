/* eslint-disable jsx-a11y/anchor-is-valid */
/* eslint-disable jsx-a11y/anchor-has-content */

// Import the ethers library
import "@ethersproject/shims";
import { BigNumber, ethers } from "ethers";

// We import the contract's artifacts and address here, as we are going to be
// using them with ethers
import RandomWalkNFTArtifact from "../contracts/rwnft.json";
import ImpishSpiralArtifact from "../contracts/impishspiral.json";
import ImpishDAOArtifact from "../contracts/impdao.json";
import SpiralMarketArtifact from "../contracts/spiralmarket.json";
import SpiralBitsArtifact from "../contracts/spiralbits.json";
import SpiralStakingArtifact from "../contracts/spiralstaking.json";
import RWNFTStakingArtifact from "../contracts/rwnftstaking.json";
import MultiMintArtifact from "../contracts/multimint.json";
import BuyWithEtherArtifact from "../contracts/buywithether.json";
import Crystal from "../contracts/crystal.json";
import StakingV2 from "../contracts/stakingv2.json";
import contractAddresses from "../contracts/contract-addresses.json";

import { Container, Button, Alert, Modal, Row, Col, ToastContainer, Toast } from "react-bootstrap";
import { ImpishDAO } from "./ImpishDAO";
import React from "react";
import { DappState, ERROR_CODE_TX_REJECTED_BY_USER, NFTForSale, ToastInfo, WANTED_NETWORK_ID } from "../AppState";

import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ImpishSpiral } from "./ImpishSpiral";
import { SpiralDetail } from "./SpiralDetail";
import { Top10 } from "./Top10";
import { Marketplace } from "./Marketplace";
import { SpiralStaking } from "./StakingV2";
import { cloneDeep } from "lodash";
import { Crystals } from "./Crystals";
import { CrystalWallet } from "./Wallet";
import { MultiTxItem } from "./walletutils";
import { MultiTxModal } from "./MultiTxModal";

// Needed to make the typescript compiler happy about the use of window.ethereum
declare const window: any;

type ModalDialogProps = {
  title: string;
  message: JSX.Element;
  show: boolean;
  close: () => void;
};
const ModalDialog = ({ title, message, show, close }: ModalDialogProps) => {
  return (
    <Modal show={show} onHide={close}>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>{message}</Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={close}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

type DappProps = {};

export class Dapp extends React.Component<DappProps, DappState> {
  constructor(props: DappProps) {
    super(props);

    this.state = new DappState();
  }

  _initialize = (userAddress: string) => {
    // This method initializes the dapp

    // We first store the user's address in the component's state
    this.setState({
      selectedAddress: userAddress,
    });

    // Fetching the token data and the user's balance are specific to this
    // sample project, but you can reuse the same initialization pattern.
    this._intializeEthers();
  };

  _intializeEthers = async () => {
    // We first initialize ethers by creating a provider using window.ethereum
    const provider = new ethers.providers.Web3Provider(window.ethereum);

    // When, we initialize the contract using that provider and the token's
    // artifact. You can do this same thing with your contracts.
    const impdao = new ethers.Contract(contractAddresses.ImpishDAO, ImpishDAOArtifact.abi, provider.getSigner(0));

    // Interface to RWNFT
    const rwnft = new ethers.Contract(
      contractAddresses.RandomWalkNFT,
      RandomWalkNFTArtifact.abi,
      provider.getSigner(0)
    );

    // Interface to ImpishSpiral contract
    const impspiral = new ethers.Contract(
      contractAddresses.ImpishSpiral,
      ImpishSpiralArtifact.abi,
      provider.getSigner(0)
    );

    // Spiral Market Contract
    const spiralmarket = new ethers.Contract(
      contractAddresses.SpiralMarket,
      SpiralMarketArtifact.abi,
      provider.getSigner(0)
    );

    // Multimint contract
    const multimint = new ethers.Contract(contractAddresses.MultiMint, MultiMintArtifact.abi, provider.getSigner(0));

    // SPIRALBITS
    const spiralbits = new ethers.Contract(contractAddresses.SpiralBits, SpiralBitsArtifact.abi, provider.getSigner(0));

    // Spiral Staking
    const spiralstaking = new ethers.Contract(
      contractAddresses.SpiralStaking,
      SpiralStakingArtifact.abi,
      provider.getSigner(0)
    );

    // RWNFT staking
    const rwnftstaking = new ethers.Contract(
      contractAddresses.RWNFTStaking,
      RWNFTStakingArtifact.abi,
      provider.getSigner(0)
    );

    // Buy ImpishDAO NFTs with ETH or Spiralbits
    const buywitheth = new ethers.Contract(
      contractAddresses.BuyWithEther,
      BuyWithEtherArtifact.abi,
      provider.getSigner(0)
    );

    // Impish Crystals
    const crystal = new ethers.Contract(contractAddresses.Crystal, Crystal.abi, provider.getSigner(0));

    // Staking V2
    const stakingv2 = new ethers.Contract(contractAddresses.StakingV2, StakingV2.abi, provider.getSigner(0));

    const contracts = {
      provider,
      rwnft,
      impdao,
      impspiral,
      spiralmarket,
      multimint,
      spiralbits,
      spiralstaking,
      rwnftstaking,
      buywitheth,
      crystal,
      stakingv2,
    };
    this.setState({ contracts });

    this.readDappState();
    this.readUserData();
  };

  addChainRequest = (ethereum: any) => {
    return ethereum.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: "0xa4b1",
          chainName: "Arbitrum One",
          rpcUrls: ["https://arb1.arbitrum.io/rpc"],
          blockExplorerUrls: ["https://arbiscan.io"],
          nativeCurrency: {
            name: "AETH",
            symbol: "AETH",
            decimals: 18,
          },
        },
      ],
    });
  };

  switchRequest = (ethereum: any) => {
    let networkIdString = "0x" + parseFloat(WANTED_NETWORK_ID).toString(16);
    return window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: networkIdString }],
    });
  };

  _connectWallet = async () => {
    // This method is run when the user clicks the Connect. It connects the
    // dapp to the user's wallet, and initializes it.
    if (window.ethereum === undefined) {
      this.showModal(
        "No Metamask",
        <div>
          Did not detect Metamask. <br />
          Please install{" "}
          <a href="https://metamask.io/" target="_blank" rel="noreferrer">
            Metamask
          </a>{" "}
          to use ImpishDAO
        </div>
      );
      return;
    }

    // To connect to the user's wallet, we have to run this method.
    // It returns a promise that will resolve to the user's address.
    try {
      const [selectedAddress] = await window.ethereum.request({ method: "eth_requestAccounts" });
      await this.switchRequest(window.ethereum);

      // Once we have the address, we can initialize the application.
      this._initialize(selectedAddress);
    } catch (error: any) {
      if (error.code === 4902) {
        try {
          await this.addChainRequest(window.ethereum);
          await this.switchRequest(window.ethereum);
        } catch (addError) {
          console.log(addError);
        }
      }
    }

    // We reinitialize it whenever the user changes their account.
    window.ethereum.on("accountsChanged", ([newAddress]: [string]) => {
      console.log("Account changed");
      // `accountsChanged` event can be triggered with an undefined newAddress.
      // This happens when the user removes the Dapp from the "Connected
      // list of sites allowed access to your addresses" (Metamask > Settings > Connections)
      // To avoid errors, we reset the dapp state
      if (newAddress === undefined) {
        return this._resetState();
      }

      this._initialize(newAddress);
    });

    // We reset the dapp state if the network is changed
    window.ethereum.on("chainChanged", (networkId: string) => {
      console.log("Chain changed");
      if (networkId === "0x" + parseFloat(WANTED_NETWORK_ID).toString(16)) {
        return;
      }

      this._resetState();
      console.log(`Network is now ${networkId}`);
    });
  };

  // This method resets the state
  _resetState = () => {
    this.setState(new DappState(), () => {
      // After the new state is set, refresh all data from the server
      this.readDappState();
    });
  };

  // This method just clears part of the state.
  _dismissNetworkError = () => {
    this.setState({ networkError: undefined });
  };

  readDappState = async () => {
    fetch("/lastethprice")
      .then((r) => r.json())
      .then((data) => {
        const lastETHPrice = data.lastETHPrice;

        this.setState({ lastETHPrice });
      });

    fetch("/impishdaoapi")
      .then((r) => r.json())
      .then((data) => {
        if (data.contractState === undefined) {
          // server returned empty response, so just return
          // TODO Show error instead of just loading...
          return;
        }

        const areWeWinning = data.areWeWinning;
        const contractState = data.contractState;
        const isRoundFinished = data.isRoundFinished;
        const daoBalance = BigNumber.from(data.daoBalance);
        const totalTokenSupply = BigNumber.from(data.totalTokenSupply);

        const mintPrice = BigNumber.from(data.mintPrice);
        const lastMintTime = BigNumber.from(data.lastMintTime);
        const withdrawalAmount = BigNumber.from(data.withdrawalAmount);

        const nftsWithPrice = Array.from(data.nftsWithPrice).map((n) => {
          const nftData: any = n;
          return new NFTForSale(BigNumber.from(nftData.tokenId), BigNumber.from(nftData.price));
        });

        this.setState({
          areWeWinning,
          contractState,
          daoBalance,
          isRoundFinished,
          mintPrice,
          withdrawalAmount,
          lastMintTime,
          totalTokenSupply,
          nftsWithPrice,
        });
      });
  };

  readUserData = async () => {
    if (this.state.selectedAddress) {
      const impishTokenBalance = await this.state.contracts?.impdao.balanceOf(this.state.selectedAddress);
      const spiralBitsBalance = await this.state.contracts?.spiralbits.balanceOf(this.state.selectedAddress);
      const ethBalance =
        (await this.state.contracts?.provider.getBalance(this.state.selectedAddress)) || BigNumber.from(0);

      this.setState({ impishTokenBalance, spiralBitsBalance, ethBalance });
    }
  };

  componentDidMount() {
    this.readDappState();
  }

  showModal = (title: string, message: JSX.Element, modalCloseCallBack?: () => void) => {
    this.setState({ modalTitle: title, modalMessage: message, modalShowing: true, modalCloseCallBack });
  };

  hideToast = (id: number) => {
    const newToasts = this.state.currentToasts
      .map((toast) => {
        if (!toast.show || toast.id === id) {
          return null;
        } else {
          return toast;
        }
      })
      .filter((t) => t) as Array<ToastInfo>;
    this.setState({ currentToasts: newToasts });
  };

  showToast = (title: string, body: JSX.Element, autohide?: boolean): number => {
    const newToasts = cloneDeep(this.state.currentToasts);
    const id = newToasts.length + 1;
    autohide = autohide || false;
    newToasts.push({ title, body, autohide, id, show: true });

    this.setState({ currentToasts: newToasts });
    return id;
  };

  executeMultiTx = async (txns: MultiTxItem[]): Promise<boolean> => {
    return new Promise<boolean>((resolve, reject) => {
      this.setState({ multiTxModal: { show: true, txns, resolve, reject } });
    });
  };

  cancelMultiTx = () => {
    const { reject } = this.state.multiTxModal;
    this.setState({ multiTxModal: { show: false, txns: [] } });
    if (reject) {
      reject("Cancelled");
    }
  };

  finishMultiTx = () => {
    const { resolve } = this.state.multiTxModal;
    this.setState({ multiTxModal: { show: false, txns: [] } });

    if (resolve) {
      resolve(true);
    }
  };

  waitForTxConfirmation = async (tx: Promise<any>, title?: string): Promise<boolean> => {
    const id = this.showToast(title || "Sending Tx", <span>Waiting for confirmations...</span>);
    let success = true;
    try {
      const t = await tx;
      await t.wait();
    } catch (e: any) {
      success = false;
      if (e?.code !== ERROR_CODE_TX_REJECTED_BY_USER) {
        // User cancelled, so do nothing
        this.showModal("Error Sending Tx", <div>{e?.data?.message || e?.message}</div>);
      }
    } finally {
      this.hideToast(id);
    }

    return success;
  };

  render() {
    return (
      <BrowserRouter>
        <Container>
          <MultiTxModal
            show={this.state.multiTxModal.show}
            txns={this.state.multiTxModal.txns}
            onCancel={this.cancelMultiTx}
            onFinish={this.finishMultiTx}
            waitForTxConfirmation={this.waitForTxConfirmation}
          />

          <ModalDialog
            message={this.state.modalMessage || <></>}
            title={this.state.modalTitle || ""}
            show={this.state.modalShowing}
            close={() => {
              this.setState({ modalShowing: false });
              if (this.state.modalCloseCallBack) {
                this.state.modalCloseCallBack();
              }
            }}
          />

          <div className="mt-5" />
          {this.state.networkError && (
            <Alert
              style={{ maxWidth: "50%", marginLeft: "25%" }}
              variant="danger"
              onClose={() => this._dismissNetworkError()}
              dismissible
            >
              {this.state.networkError}
            </Alert>
          )}

          <Routes>
            <Route path="/" element={<Navigate replace to="/spirals" />} />

            <Route
              path="/impishdao/*"
              element={
                <ImpishDAO
                  {...this.state}
                  connectWallet={this._connectWallet}
                  readDappState={this.readDappState}
                  readUserData={this.readUserData}
                  waitForTxConfirmation={this.waitForTxConfirmation}
                  executeMultiTx={this.executeMultiTx}
                  showModal={this.showModal}
                />
              }
            />

            <Route
              path="/crystals/*"
              element={
                <Crystals
                  {...this.state}
                  connectWallet={this._connectWallet}
                  readDappState={this.readDappState}
                  readUserData={this.readUserData}
                  showModal={this.showModal}
                  waitForTxConfirmation={this.waitForTxConfirmation}
                  executeMultiTx={this.executeMultiTx}
                />
              }
            />

            <Route
              path="/spirals"
              element={
                <ImpishSpiral
                  {...this.state}
                  connectWallet={this._connectWallet}
                  readDappState={this.readDappState}
                  readUserData={this.readUserData}
                  showModal={this.showModal}
                  waitForTxConfirmation={this.waitForTxConfirmation}
                  executeMultiTx={this.executeMultiTx}
                />
              }
            />

            <Route
              path="/spiralstaking"
              element={
                <SpiralStaking
                  {...this.state}
                  connectWallet={this._connectWallet}
                  readDappState={this.readDappState}
                  readUserData={this.readUserData}
                  showModal={this.showModal}
                  waitForTxConfirmation={this.waitForTxConfirmation}
                  executeMultiTx={this.executeMultiTx}
                />
              }
            />

            <Route
              path="/wallet/:address/:type"
              element={<CrystalWallet {...this.state} connectWallet={this._connectWallet} />}
            />

            <Route
              path="/spirals/marketplace"
              element={<Marketplace {...this.state} connectWallet={this._connectWallet} />}
            />

            <Route
              path="/spirals/detail/:id"
              element={
                <SpiralDetail
                  {...this.state}
                  connectWallet={this._connectWallet}
                  readDappState={this.readDappState}
                  readUserData={this.readUserData}
                  showModal={this.showModal}
                  waitForTxConfirmation={this.waitForTxConfirmation}
                  executeMultiTx={this.executeMultiTx}
                />
              }
            />

            <Route path="/spirals/top10" element={<Top10 {...this.state} connectWallet={this._connectWallet} />} />
          </Routes>

          <ToastContainer position="bottom-end" className="p-3">
            {this.state.currentToasts.map((toast) => {
              return (
                <Toast
                  key={toast.id}
                  onClose={() => this.hideToast(toast.id)}
                  show={toast.show}
                  delay={5000}
                  autohide={toast.autohide}
                  bg="dark"
                >
                  <Toast.Header>
                    <strong className="me-auto">{toast.title}</strong>
                  </Toast.Header>
                  <Toast.Body>{toast.body}</Toast.Body>
                </Toast>
              );
            })}
          </ToastContainer>

          <Row
            className="mt-2"
            style={{ textAlign: "center", backgroundColor: "#222", padding: "20px", height: "150px" }}
          >
            <Col xs={{ span: 2, offset: 8 }} style={{ marginTop: 30 }}>
              <a
                style={{ color: "white", textDecoration: "none" }}
                target="_blank"
                rel="noreferrer"
                href="https://www.twitter.com/impishdao"
              >
                <img src="/twitterlogo.jpg" style={{ width: "30px" }} alt="twitter" /> @impishdao
              </a>
            </Col>
          </Row>
        </Container>
      </BrowserRouter>
    );
  }
}
