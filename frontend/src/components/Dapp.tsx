/* eslint-disable jsx-a11y/anchor-is-valid */
/* eslint-disable jsx-a11y/anchor-has-content */

// Import the ethers library
import "@ethersproject/shims"
import { BigNumber, Contract, ContractTransaction, ethers } from "ethers";

// We import the contract's artifacts and address here, as we are going to be
// using them with ethers
import RandomWalkNFTArtifact from "../contracts/rwnft.json";
import ImpishDAOArtifact from "../contracts/impdao.json";
import contractAddresses from "../contracts/contract-addresses.json";
import ImpishDAOConfig from "../impishdao-config.json";
import React, { useEffect, useState } from "react";
import { Web3Provider } from "@ethersproject/providers";
import { Container, Nav, Navbar, Button, Alert, InputGroup, FormControl, Row, Col, Stack, Card, Modal } from "react-bootstrap";
import Whitepaper from "./Whitepaper";
import { format4Decimals, formatUSD, secondsToDhms } from "./utils";

// Needed to make the typescript compiler happy about the use of window.ethereum
declare const window: any;

const ARBITRUM_NETWORK_ID = '42161';

const WANTED_NETWORK_ID = ImpishDAOConfig.NetworkID || ARBITRUM_NETWORK_ID;

// This is an error code that indicates that the user canceled a transaction
const ERROR_CODE_TX_REJECTED_BY_USER = 4001;

let timeNow = Date.now();

function pad(num: string, size: number): string {
  var s = "000000000" + num;
  return s.substr(s.length-size);
}

class NFTForSale {
  tokenId: BigNumber;
  price: BigNumber;

  constructor(
    _tokenID: BigNumber,
    _price: BigNumber
  ) {
    this.tokenId = _tokenID;
    this.price = _price;
  }
};

type DappProps = {};
class DappState {
    networkError?: string;
    lastETHPrice?: number;

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

    // User specific state
    tokenBalance: BigNumber;
    selectedAddress?: string;

    // List of NFTs for sale by the DAO
    nftsWithPrice: Array<NFTForSale>;

    modalTitle?: string;
    modalMessage?: JSX.Element;
    modalShowing: boolean;

    constructor() {
      this.areWeWinning = false;
      this.isRoundFinished = false;

      this.tokenBalance = BigNumber.from(0);
      this.nftsWithPrice = [];

      this.modalShowing = false;
    }
};


type BeenOutbidProps = DappState & {
  depositIntoDAO: (amount: BigNumber) => Promise<void>;
  connectWallet: () => void;
};
const BeenOutbid = ({mintPrice, daoBalance, selectedAddress, lastETHPrice, depositIntoDAO, connectWallet}: BeenOutbidProps) => {
  let neededInEth = BigNumber.from(0);

  if (mintPrice !== undefined && daoBalance !== undefined) {
    neededInEth = mintPrice.sub(daoBalance);
    if (neededInEth.lt(0)) {
      neededInEth = ethers.utils.parseEther("0.001");
    }
  }
  const [value, setValue] = useState(ethers.utils.formatEther(neededInEth));
  const [tokensRecieved, setTokensRecieved] = useState(ethers.utils.formatEther(neededInEth.mul(1000)));
  
  const inputChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    const text = event?.target?.value || '';
    setValue(text);

    if (text.trim().length === 0) {
      setTokensRecieved("0");
    } else {
      const p = ethers.utils.parseEther(text);
      console.log(p);
      setTokensRecieved(ethers.utils.formatEther(p.mul(1000)));
    }
  }

  return (
    <>
      <h1>ImpishDAO has been outbid!</h1>
      <div className="mb-5" style={{marginTop: "-20px"}}>
        <a href="#whitepaper" className="mb-5" style={{color: "#ffc106"}}>What is ImpishDAO?</a>
      </div>
      {neededInEth.gt(0) && (
        <>
          <div>Additional ETH needed for ImpishDAO to win:</div>
          <h1>ETH {format4Decimals(neededInEth)}</h1>
          <div className="usdFaded mb-2">{formatUSD(neededInEth, lastETHPrice)}</div>
          <div className="mb-2">Contribute to ImpishDAO to get back to winning!</div>
        </>
      )}
      {neededInEth.isZero() && (
        <>
          <div className="mb-2">ImpishDAO has enough ETH to get back to winning!</div>
          <div className="mb-2">Mint some tokens to get back to winning!</div>
        </>
      )}
      
      <Row className="justify-content-md-center mt-4">
        {!selectedAddress && 
         <div>
            <Button className="connect"
            variant="warning"
            onClick={() => connectWallet()}
            >
              Connect Wallet
            </Button>
          </div>
        }

        {selectedAddress && (
            <div style={{border: 'solid 1px #ffd454', borderRadius: '15px', padding: '20px', maxWidth: '600px', backgroundColor: '#222'}}>
              <h2>Join ImpishDAO</h2>
              <Row className="justify-content-md-center mt-4">
                  <Stack direction="horizontal" gap={3} className="mb-3">
                    <InputGroup>
                      <InputGroup.Text>ETH</InputGroup.Text>
                      <FormControl step={0.1} className="ethinput" type="number" value={value} onChange={inputChanged} />
                      
                    </InputGroup>
                    <Button variant="warning" onClick={
                        () => depositIntoDAO(ethers.utils.parseEther(value))}>
                          Contribute
                    </Button>
                  </Stack>
                  <div className="mb-3">
                    You will receive {tokensRecieved} IMPISH Tokens
                  </div>
              </Row>
            </div>
          
        )}  
      </Row>
    </>
  )
};

const WeAreWinning = ({
    withdrawalAmount, tokenBalance, totalTokenSupply, daoBalance, 
    selectedAddress, lastMintTime, lastETHPrice, depositIntoDAO, 
    connectWallet}
  : BeenOutbidProps) => {
  let timeRemainingInitial = 0;
  if (lastMintTime !== undefined) {
    timeRemainingInitial =  (lastMintTime.toNumber() + 30 * 24 * 3600) - (timeNow / 1000);
  }

  const [value, setValue] = useState("0.1");
  const [tokensRecieved, setTokensRecieved] = useState("100");
  const [timeRemaining, setTimeRemaining] = useState(timeRemainingInitial);

  const inputChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    const text = event?.target?.value || '';
    setValue(text);

    if (text.trim().length === 0) {
      setTokensRecieved("0");
    } else {
      const p = ethers.utils.parseEther(text);
      console.log(p);
      setTokensRecieved(ethers.utils.formatEther(p.mul(1000)));
    }
  }

  useEffect(() => {
    const timerID = setInterval(() => {
      setTimeRemaining(timeRemaining - 1);
    }, 1000)

    return function cleanup() {
      clearInterval(timerID);
    }
  })

  if (withdrawalAmount === undefined || daoBalance === undefined || totalTokenSupply === undefined) {
    return <></>;
  }

  let myShareOfWinnings;
  if (selectedAddress) {
    myShareOfWinnings = tokenBalance.mul(withdrawalAmount.add(daoBalance)).div(totalTokenSupply);
  }

  return (
    <>
      <h1>ImpishDAO is Winning!</h1>
      <div className="mb-5" style={{marginTop: "-20px"}}>
        <a href="#whitepaper" className="mb-5" style={{color: "#ffc106"}}>What is ImpishDAO?</a>
      </div>
      <div>ImpishDAO will win</div>
      <h1>ETH {format4Decimals(withdrawalAmount.add(daoBalance))}</h1>
      <div className="usdFaded">{formatUSD(withdrawalAmount.add(daoBalance), lastETHPrice)}</div>
      <div className="mb-2">
        {myShareOfWinnings && <span>
          Your potential share <br/>
          <h4>ETH {format4Decimals(myShareOfWinnings)}</h4>
          <div className="usdFadedSmall">{formatUSD(myShareOfWinnings, lastETHPrice)}</div>
        </span>
        }
      </div>
      <div>if not outbid in</div>
      <h4 className="mb-2" style={{fontFamily: "monospace"}}>{secondsToDhms(timeRemaining)}</h4>

      <Row className="justify-content-md-center mt-4">
        {!selectedAddress && 
         <div>
            <Button className="connect"
            variant="warning"
            onClick={() => connectWallet()}
            >
              Connect Wallet
            </Button>
          </div>
        }

        {selectedAddress && (
            <div style={{border: 'solid 1px #ffd454', borderRadius: '15px', padding: '20px', maxWidth: '600px', backgroundColor: '#222'}}>
              <h2>Join ImpishDAO</h2>
              <Row className="justify-content-md-center mt-4">
                  <Stack direction="horizontal" gap={3} className="mb-3">
                    <InputGroup>
                      <InputGroup.Text>ETH</InputGroup.Text>
                      <FormControl step={0.1} className="ethinput" type="number" value={value} onChange={inputChanged} />
                      
                    </InputGroup>
                    <Button variant="warning" onClick={
                        () => depositIntoDAO(ethers.utils.parseEther(value))}>
                          Contribute
                    </Button>
                  </Stack>
                  <div className="mb-3">
                    You will receive {tokensRecieved} IMPISH Tokens
                  </div>
              </Row>
            </div>
          
        )}  
      </Row>
    </>
  )
}

const WeWon = ({selectedAddress, depositIntoDAO}: BeenOutbidProps) => {
  return (
    <>
      <h1>ImpishDAO has Won!</h1>
      {selectedAddress && (
        <>
          <div>Quick! Claim the win on ImpishDAO's behalf!</div>
          <Button variant="warning" onClick={
            () => depositIntoDAO(BigNumber.from(0))}>
              Claim Win!
          </Button>
        </>
      )}
    </>
  );
}

type RedeemProps = DappState & {
  redeemTokens: () => void;
};
const Redeem = ({selectedAddress, tokenBalance, daoBalance, contractState, totalTokenSupply, redeemTokens}: RedeemProps) => {
  let title = '';

  if (contractState === 0) {
    title = 'Paused';
  } else if (contractState === 2) {
    title = 'Won';
  } else if (contractState === 3) {
    title = 'Lost'
  }

  let ethRedeemable = BigNumber.from(0);
  if (tokenBalance !== undefined && totalTokenSupply !== undefined &&
      daoBalance !== undefined && daoBalance.gt(0)) {
    ethRedeemable = tokenBalance.mul(daoBalance).div(totalTokenSupply);
  } 

  return (
    <>
      <h1>ImpishDAO has {title}!</h1>
      <h3 className="mt-2"> You can now redeem your tokens for ETH </h3>
      {selectedAddress && (
        <>
          <Row className="justify-content-md-center mt-4">
              <Col xs lg="4">
              <div className="mb-3">
                  You have <br/>
                  <h4>{ethers.utils.formatEther(tokenBalance)} IMPISH Tokens</h4>
              </div>
              <div className="mb-3">
                  which can be redeemed for 
                  <br/>
                  <h4>ETH {format4Decimals(ethRedeemable)}</h4>
                </div>
              </Col>
          </Row>
          {tokenBalance.gt(0) && 
            <Button variant="warning" onClick={() => redeemTokens()}>Redeem</Button>
          }
        </>
      )}
      
    </>
  );
}

const Loading = () => {
  return (
    <>
      <h1>ImpishDAO is loading ...</h1>
    </>
  );
}

type ModalDialogProps = {
  title: string;
  message: JSX.Element;
  show: boolean;
  close: () => void;
}
const ModalDialog = ({title, message, show, close}: ModalDialogProps) => {
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
}


export class Dapp extends React.Component<DappProps, DappState> {
    _provider?: Web3Provider;
    _impdao?: Contract;
    _rwnft?: Contract;

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
    this._provider = new ethers.providers.Web3Provider(window.ethereum);

    // When, we initialize the contract using that provider and the token's
    // artifact. You can do this same thing with your contracts.
    this._impdao = new ethers.Contract(
      contractAddresses.ImpishDAO,
      ImpishDAOArtifact.abi,
      this._provider.getSigner(0)
    );

    this._rwnft = new ethers.Contract(
      contractAddresses.RandomWalkNFT,
      RandomWalkNFTArtifact.abi,
      this._provider
    );

    this.readDAOandNFTData();
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
  }

  async _connectWallet() {
    // This method is run when the user clicks the Connect. It connects the
    // dapp to the user's wallet, and initializes it.
    if (window.ethereum === undefined) {
      this.showModal("No Metamask", <div>
        Did not detect Metamask. <br/>
        Please install <a href="https://metamask.io/" target="_blank" rel="noreferrer">Metamask</a> to use ImpishDAO
      </div>);
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
      this.readDAOandNFTData();
    });
  }


  // This method just clears part of the state.
  _dismissNetworkError() {
    this.setState({ networkError: undefined });
  }

  buyNFTFromDAO = async (tokenId: BigNumber) => {
    // Wait for this Tx to be mined, then refresh all data.
    try {
      let tx: ContractTransaction = await this._impdao?.buyNFT(tokenId);

      await tx.wait();
      const tokenIdPadded = pad(tokenId.toString(), 6);

      this.showModal("Congrats on your new NFT!", 
        <div>
          Congrats on purchasing RandomWalkNFT #{tokenIdPadded}<br/>
          <a href={`https://randomwalknft.com/detail/${tokenIdPadded}`} target="_blank"  rel='noreferrer'>
            View on RandomWalkNFT
          </a>
        </div>
      )

      // Set a timer to refresh data after a few seconds, so that the server has time to process the event
      setTimeout(() => {
        this.readDAOandNFTData();
        this.readUserData();
      }, 1000 * 5);
    } catch (e: any) {
      console.log(e);

      // If user didn't cancel
      if (e?.code !== ERROR_CODE_TX_REJECTED_BY_USER) {  
        this.showModal("Not Enough IMPISH Tokens!", 
        <div>
          You don't have enough IMPISH tokens to buy this NFT!
          <br/>
          Buy IMPISH tokens by contributing to ImpishDAO or from <a href="https://app.uniswap.org/#/swap?inputCurrency=ETH&outputCurrency=0x36f6d831210109719d15abaee45b327e9b43d6c6" target="_blank"  rel='noreferrer'>Uniswap</a>
        </div>);
      } 
    }
  }

  depositIntoDAO = async (amount: BigNumber) => {
    try {
      // Wait for this Tx to be mined, then refresh all data.
      let tx: ContractTransaction = await this._impdao?.deposit({value: amount});

      // Wait for Tx confirmation
      await tx.wait();

      // Refresh data
      this.readDAOandNFTData();
      this.readUserData();

      const bal = await this._impdao?.balanceOf(this.state.selectedAddress);

      this.showModal("Yay!", 
        <div>
          You successfully contributed and now have {ethers.utils.formatEther(bal)} IMPISH
        </div>
      );

      // Set a timer to refresh data after a few seconds, so that the server has time to process the event
      setTimeout(() => {
        this.readDAOandNFTData();
        this.readUserData();
      }, 1000 * 5);
    } catch (e: any) {
      console.log(e);

      let msg: string | undefined;
      if (e?.data?.message?.includes("Too much ETH")) {
        msg = 'You are depositing too much ETH. Please lower the amount and try again';
      } else if (e?.code === ERROR_CODE_TX_REJECTED_BY_USER) {
        // User cancelled, so do nothing
        msg = undefined;
      } else {
        msg = `Error: ${e?.data?.message}`;
      }

      if (msg) {
        this.showModal("Error Contributing to ImpishDAO!", <div>{msg}</div>);
      }
    }
  };

  redeemTokens = async () => {
    // Wait for this Tx to be mined, then refresh all data.
    try {
      let tx: ContractTransaction = await this._impdao?.redeem();

      // Wait for Tx confirmation
      await tx.wait();

      // Refresh data
      this.readDAOandNFTData();
      this.readUserData();

      this.showModal("Successfully Redeemed IMPISH!", 
      <div>
        You successfully redeemed all your IMPISH.
      </div>
    );
    } catch (e: any) {
      console.log(e);

      // If user didn't cancel
      if (e?.code !== ERROR_CODE_TX_REJECTED_BY_USER) {
        this.showModal("Error Redeeming tokens!", <div>{e?.data?.message}</div>);
      } 
    }
  }

  readDAOandNFTData = async () => {
    fetch("/api").then(r => r.json()).then(data => {
      const areWeWinning = data.areWeWinning;
      const contractState = data.contractState;
      const isRoundFinished = data.isRoundFinished;
      const daoBalance = BigNumber.from(data.daoBalance);
      const totalTokenSupply = BigNumber.from(data.totalTokenSupply);

      const mintPrice = BigNumber.from(data.mintPrice);
      const lastMintTime = BigNumber.from(data.lastMintTime);
      const withdrawalAmount = BigNumber.from(data.withdrawalAmount);

      const lastETHPrice = data.lastETHPrice;
      
      const nftsWithPrice = Array.from(data.nftsWithPrice).map(n => {
        const nftData: any = n; 
        return new NFTForSale(BigNumber.from(nftData.tokenId), BigNumber.from(nftData.price));
      });

      this.setState({areWeWinning, contractState, daoBalance, isRoundFinished, 
          mintPrice, withdrawalAmount, lastMintTime, totalTokenSupply,
          lastETHPrice, nftsWithPrice});
    });
  };

  readUserData = async () => {
    const tokenBalance = await this._impdao?.balanceOf(this.state.selectedAddress);
    this.setState({tokenBalance});
  }

  componentDidMount() {
    this.readDAOandNFTData();
  }

  showModal = (title: string, message: JSX.Element) => {
    this.setState({modalTitle: title, modalMessage: message, modalShowing: true});
  }

  AdminDepositExternal = async () => {
    if (this._provider) {
      (await this._rwnft?.connect(this._provider.getSigner(0)).mint({value: this.state.mintPrice})).wait().then(() => {
        this.readDAOandNFTData();
        this.readUserData();
      });
    }
  };

  AdminWithdraw = async() => {
    if (this._provider) {
      (await this._rwnft?.connect(this._provider.getSigner(0)).withdraw()).wait().then(() => {
        this.readDAOandNFTData();
        this.readUserData();
      });
    }
  }

  render() {
      // Determine what to render on the main page
      let renderScreen = 0;

      console.log(this.state);

      // If state has loaded
      if (this.state.contractState !== undefined) {
        if (this.state.isRoundFinished || this.state.contractState !== 1) {
          renderScreen = 1; // Redeem page, since the round is finished or contract is not playable
        } else {
          let now = BigNumber.from(timeNow).div(1000);
          if (this.state.lastMintTime && now.sub(this.state.lastMintTime).toNumber() > 3600 * 24 * 30) { // 1 month
            renderScreen = 2; // We are about to win!
          } else {
            if (this.state.areWeWinning) {
              renderScreen = 3; // We are winning, but not yet won!
            } else {
              renderScreen = 4; // We are loosing, but not yet lost!
            }
          }
        }
      }

      return (
          <Container fluid>
            <ModalDialog 
              message={this.state.modalMessage || <></>} 
              title={this.state.modalTitle || ''} 
              show={this.state.modalShowing} 
              close={() => this.setState({modalShowing: false})} 
            />

            <Navbar fixed="top" style={{borderBottom: "1px solid #fff"}} variant="dark" bg="dark">
              <Container>
                <Navbar.Brand href="#home">ImpishDAO</Navbar.Brand>
                <Nav className="me-auto">
                  <Nav.Link href="#home">Home</Nav.Link>
                  <Nav.Link href="#nftsforsale">NFTs for Sale</Nav.Link>
                  <Nav.Link href="#whitepaper">FAQ</Nav.Link>
                </Nav>
                {!this.state.selectedAddress && 
                    <Button className="connect"
                    variant="warning"
                    onClick={() => this._connectWallet()}
                  >
                    Connect Wallet
                  </Button>
                }
                {this.state.selectedAddress && (
                  <>
                    <div style={{marginRight: '10px'}}>Wallet: {format4Decimals(this.state.tokenBalance)} IMPISH</div>
                    <Button className="address" variant="warning">{this.state.selectedAddress}</Button>
                  </>
                )}
              </Container>
            </Navbar>
            
            <div className="mt-5" />
            {this.state.networkError && 
              <Alert style={{maxWidth: '50%', marginLeft: '25%'}} variant="danger" onClose={() => this._dismissNetworkError()} dismissible>
                  {this.state.networkError}
              </Alert>
            }

            <a id="home"></a>
            <div className="withBackground" style={{textAlign: 'center', marginTop: '-50px', paddingTop: '100px'}}>
              {renderScreen === 4 && (
                <BeenOutbid {...this.state} depositIntoDAO={this.depositIntoDAO} connectWallet={() => this._connectWallet()} />
              )}
              {renderScreen === 3 && (
                <WeAreWinning {...this.state} depositIntoDAO={this.depositIntoDAO} connectWallet={() => this._connectWallet()} />
              )}
              {renderScreen === 2 && (
                <WeWon {...this.state} depositIntoDAO={this.depositIntoDAO} connectWallet={() => this._connectWallet()} />
              )}
              {renderScreen === 1 && (
                <Redeem {...this.state} redeemTokens={this.redeemTokens} />
              )}
              {renderScreen === 0 && (
                <Loading />
              )}
            </div>

            {this.state.nftsWithPrice.length > 0 && (
              <>
              <a id="nftsforsale"></a>
              <Row className="mb-5" style={{textAlign: 'center', backgroundColor: '#222', padding: '20px'}}>
                  <h1>NFTs for Sale</h1>
              </Row>

              <Row className="justify-content-md-center">
                {this.state.nftsWithPrice.map((nft) => {

                const imgurl = `https://randomwalknft.s3.us-east-2.amazonaws.com/${pad(nft.tokenId.toString(), 6)}_black_thumb.jpg`;
                const price = parseFloat(ethers.utils.formatEther(nft.price)).toFixed(4);

                return (
                  <Col xl={3} className="mb-3" key={nft.tokenId.toString()} >
                    <Card style={{width: '320px', padding: '10px', borderRadius: '5px'}} key={nft.tokenId.toString()}>
                      <Card.Img variant="top" src={imgurl} style={{maxWidth: '300px'}} />
                      <Card.Body>
                        <Card.Title> #{pad(nft.tokenId.toString(), 6)}</Card.Title>
                        <Card.Text>
                          Price: {price} IMPISH
                        </Card.Text>
                        {this.state.selectedAddress && 
                          <Button variant="primary" onClick={() => this.buyNFTFromDAO(nft.tokenId)}>Buy Now</Button>
                        }
                      </Card.Body>
                    </Card>
                  </Col>
                );
                })
                }
              </Row>
              </>
            )}

            {/* <div style={{border: 'solid 1px #fff', margin: 20, padding: 20}}>
              {this.state.selectedAddress && (
                <>
                  <Stack direction="horizontal" gap={3}>
                    <Button onClick={this.AdminDepositExternal}>Mint NFT Directly</Button>
                    <Button onClick={this.AdminWithdraw}>Withdraw() Directly</Button>
                    <Button onClick={this.readDAOandNFTData}>Refresh DAO Data</Button>
                    <Button onClick={() => {
                        this.readDAOandNFTData();
                        this.readUserData();
                        timeNow += (30 * 24 * 3600 * 1000);
                      }
                    }>Advance Time</Button>
                  </Stack>
                </>
              )}              
            </div> */}

            <a id="whitepaper"></a>
            <Row className="mb-5" style={{textAlign: 'center', backgroundColor: '#222', padding: '20px'}}>
                <h1>FAQ</h1>
            </Row>
            <Whitepaper withdrawalAmount={this.state.withdrawalAmount || BigNumber.from(0)}/>
            
          </Container>
      );
  }

}