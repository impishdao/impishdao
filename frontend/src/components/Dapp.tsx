/* eslint-disable jsx-a11y/anchor-is-valid */
/* eslint-disable jsx-a11y/anchor-has-content */

// Import the ethers library
import "@ethersproject/shims";
import { BigNumber, Contract, ethers } from "ethers";

// We import the contract's artifacts and address here, as we are going to be
// using them with ethers
import RandomWalkNFTArtifact from "../contracts/rwnft.json";
import ImpishDAOArtifact from "../contracts/impdao.json";
import contractAddresses from "../contracts/contract-addresses.json";

import { Web3Provider } from "@ethersproject/providers";
import { Container, Nav, Navbar, Button, Alert, Modal } from "react-bootstrap";
import { format4Decimals } from "./utils";
import { ImpishDAO } from "./ImpishDAO";
import React from "react";
import { DappState, NFTForSale, WANTED_NETWORK_ID } from "../AppState";

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
  provider?: Web3Provider;
  impdao?: Contract;
  rwnft?: Contract;

  constructor(props: DappProps) {
    super(props);

    this.state = new DappState();
  }

  _initialize(userAddress: string) {
    // This method initializes the dapp

    // We first store the user's address in the component's state
    this.setState({
      selectedAddress: userAddress,
    });

    // Fetching the token data and the user's balance are specific to this
    // sample project, but you can reuse the same initialization pattern.
    this._intializeEthers();
  }

  async _intializeEthers() {
    // We first initialize ethers by creating a provider using window.ethereum
    this.provider = new ethers.providers.Web3Provider(window.ethereum);

    // When, we initialize the contract using that provider and the token's
    // artifact. You can do this same thing with your contracts.
    this.impdao = new ethers.Contract(contractAddresses.ImpishDAO, ImpishDAOArtifact.abi, this.provider.getSigner(0));

    this.rwnft = new ethers.Contract(contractAddresses.RandomWalkNFT, RandomWalkNFTArtifact.abi, this.provider);

    this.readDappState();
    this.readUserData();
  }

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

  async _connectWallet() {
    console.log("_connectWallet");
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
  }

  // This method resets the state
  _resetState() {
    this.setState(new DappState(), () => {
      // After the new state is set, refresh all data from the server
      this.readDappState();
    });
  }

  // This method just clears part of the state.
  _dismissNetworkError() {
    this.setState({ networkError: undefined });
  }

  readDappState = async () => {
    fetch("/lastethprice")
      .then((r) => r.json())
      .then((data) => {
        const lastETHPrice = data.lastETHPrice;

        this.setState({ lastETHPrice });
      });

    fetch("/api")
      .then((r) => r.json())
      .then((data) => {
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
    const tokenBalance = await this.impdao?.balanceOf(this.state.selectedAddress);
    this.setState({ tokenBalance });
  };

  componentDidMount() {
    this.readDappState();
  }

  showModal = (title: string, message: JSX.Element) => {
    this.setState({ modalTitle: title, modalMessage: message, modalShowing: true });
  };

  render() {
    console.log(this.state);

    return (
      <Container fluid>
        <ModalDialog
          message={this.state.modalMessage || <></>}
          title={this.state.modalTitle || ""}
          show={this.state.modalShowing}
          close={() => this.setState({ modalShowing: false })}
        />

        <Navbar fixed="top" style={{ borderBottom: "1px solid #fff" }} variant="dark" bg="dark">
          <Container>
            <Navbar.Brand href="#home">ImpishDAO</Navbar.Brand>
            <Nav className="me-auto">
              <Nav.Link href="#home">Home</Nav.Link>
              <Nav.Link href="#nftsforsale">NFTs for Sale</Nav.Link>
              <Nav.Link href="#stats">Stats</Nav.Link>
              <Nav.Link href="#whitepaper">FAQ</Nav.Link>
            </Nav>
            {!this.state.selectedAddress && (
              <Button className="connect" variant="warning" onClick={() => this._connectWallet()}>
                Connect Wallet
              </Button>
            )}
            {this.state.selectedAddress && (
              <>
                <div style={{ marginRight: "10px" }}>Wallet: {format4Decimals(this.state.tokenBalance)} IMPISH</div>
                <Button className="address" variant="warning">
                  {this.state.selectedAddress}
                </Button>
              </>
            )}
          </Container>
        </Navbar>

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

        <ImpishDAO
          {...this.state}
          connectWallet={() => this._connectWallet()}
          readDappState={() => this.readDappState()}
          readUserData={() => this.readUserData()}
          showModal={this.showModal}
          provider={this.provider}
          impdao={this.impdao}
          rwnft={this.rwnft}
        />
      </Container>
    );
  }
}
