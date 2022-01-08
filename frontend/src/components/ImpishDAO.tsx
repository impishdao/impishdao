/* eslint-disable jsx-a11y/anchor-is-valid */
/* eslint-disable jsx-a11y/anchor-has-content */
import { BigNumber, ContractTransaction, ethers } from "ethers";

import { Button, InputGroup, FormControl, Row, Col, Stack, Table } from "react-bootstrap";
import Whitepaper from "./Whitepaper";
import { format4Decimals, formatUSD, secondsToDhms } from "./utils";
import React, { useEffect, useState } from "react";
import { DappContracts, DappFunctions, DappState, ERROR_CODE_TX_REJECTED_BY_USER } from "../AppState";
import { Navigation } from "./Navigation";
import { ImpishDAOBuyNFTs } from "./ImpishDaoBuyNFT";
import { Route, Routes } from "react-router-dom";
import { Link } from "react-router-dom";

let timeNow = Date.now();

type ImpishDAOProps = DappState & DappFunctions & DappContracts & {};

type BeenOutbidProps = DappState & {
  depositIntoDAO: (amount: BigNumber) => Promise<void>;
  connectWallet: () => void;
  myShareOfWinnings?: BigNumber;
};

const BeenOutbid = ({
  mintPrice,
  daoBalance,
  selectedAddress,
  lastETHPrice,
  depositIntoDAO,
  connectWallet,
}: BeenOutbidProps) => {
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
    const text = event?.target?.value || "";
    setValue(text);

    if (text.trim().length === 0) {
      setTokensRecieved("0");
    } else {
      const p = ethers.utils.parseEther(text);
      console.log(p);
      setTokensRecieved(ethers.utils.formatEther(p.mul(1000)));
    }
  };

  return (
    <>
      <h1>ImpishDAO has been outbid!</h1>
      <div className="mb-5" style={{ marginTop: "-20px" }}>
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
        {!selectedAddress && (
          <div>
            <Button
              className="connect"
              variant="warning"
              onClick={() => {
                console.log("connect in been outbid");
                connectWallet();
              }}
            >
              Connect Wallet
            </Button>
          </div>
        )}

        {selectedAddress && (
          <div
            style={{
              border: "solid 1px #ffd454",
              borderRadius: "15px",
              padding: "20px",
              maxWidth: "600px",
              backgroundColor: "#222",
            }}
          >
            <h2>Join ImpishDAO</h2>
            <Row className="justify-content-md-center mt-4">
              <Stack direction="horizontal" gap={3} className="mb-3">
                <InputGroup>
                  <InputGroup.Text>ETH</InputGroup.Text>
                  <FormControl step={0.1} className="ethinput" type="number" value={value} onChange={inputChanged} />
                </InputGroup>
                <Button variant="warning" onClick={() => depositIntoDAO(ethers.utils.parseEther(value))}>
                  Contribute
                </Button>
              </Stack>
              <div className="mb-3">You will receive {tokensRecieved} IMPISH Tokens</div>
            </Row>
          </div>
        )}
      </Row>
    </>
  );
};

const WeAreWinning = ({
  withdrawalAmount,
  impishTokenBalance,
  totalTokenSupply,
  daoBalance,
  selectedAddress,
  lastMintTime,
  lastETHPrice,
  depositIntoDAO,
  myShareOfWinnings,
  connectWallet,
}: BeenOutbidProps) => {
  let timeRemainingInitial = 0;
  if (lastMintTime !== undefined) {
    timeRemainingInitial = lastMintTime.toNumber() + 30 * 24 * 3600 - timeNow / 1000;
  }

  const [value, setValue] = useState("0.1");
  const [tokensRecieved, setTokensRecieved] = useState("100");
  const [timeRemaining, setTimeRemaining] = useState(timeRemainingInitial);

  const inputChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    const text = event?.target?.value || "";
    setValue(text);

    if (text.trim().length === 0) {
      setTokensRecieved("0");
    } else {
      const p = ethers.utils.parseEther(text);
      console.log(p);
      setTokensRecieved(ethers.utils.formatEther(p.mul(1000)));
    }
  };

  useEffect(() => {
    const timerID = setInterval(() => {
      setTimeRemaining(timeRemaining - 60);
    }, 1000 * 60);

    return function cleanup() {
      clearInterval(timerID);
    };
  });

  if (withdrawalAmount === undefined || daoBalance === undefined || totalTokenSupply === undefined) {
    return <></>;
  }

  return (
    <>
      <h1>ImpishDAO is Winning!</h1>
      <div className="mb-5" style={{ marginTop: "-20px" }}>
      </div>
      <div>ImpishDAO will win</div>
      <h1>ETH {format4Decimals(withdrawalAmount.add(daoBalance))}</h1>
      <div className="usdFaded">{formatUSD(withdrawalAmount.add(daoBalance), lastETHPrice)}</div>
      <div className="mb-2">
        {myShareOfWinnings && (
          <span>
            Your potential share <br />
            <h4>ETH {format4Decimals(myShareOfWinnings)}</h4>
            <div className="usdFadedSmall">{formatUSD(myShareOfWinnings, lastETHPrice)}</div>
          </span>
        )}
      </div>
      <div>if not outbid in</div>
      <h4 className="mb-2" style={{ fontFamily: "monospace" }}>
        {secondsToDhms(timeRemaining)}
      </h4>

      <Row className="justify-content-md-center mt-4">
        {!selectedAddress && (
          <div>
            <Button className="connect" variant="warning" onClick={() => connectWallet()}>
              Connect Wallet
            </Button>
          </div>
        )}

        {selectedAddress && (
          <div
            style={{
              border: "solid 1px #ffd454",
              borderRadius: "15px",
              padding: "20px",
              maxWidth: "600px",
              backgroundColor: "#222",
            }}
          >
            <h2>Join ImpishDAO</h2>
            <Row className="justify-content-md-center mt-4">
              <Stack direction="horizontal" gap={3} className="mb-3">
                <InputGroup>
                  <InputGroup.Text>ETH</InputGroup.Text>
                  <FormControl step={0.1} className="ethinput" type="number" value={value} onChange={inputChanged} />
                </InputGroup>
                <Button variant="warning" onClick={() => depositIntoDAO(ethers.utils.parseEther(value))}>
                  Contribute
                </Button>
              </Stack>
              <div className="mb-3">You will receive {tokensRecieved} IMPISH Tokens</div>
            </Row>
          </div>
        )}
      </Row>
    </>
  );
};

const WeWon = ({ selectedAddress, depositIntoDAO }: BeenOutbidProps) => {
  return (
    <>
      <h1>ImpishDAO has Won!</h1>
      {selectedAddress && (
        <>
          <div>Quick! Claim the win on ImpishDAO's behalf!</div>
          <Button variant="warning" onClick={() => depositIntoDAO(BigNumber.from(0))}>
            Claim Win!
          </Button>
        </>
      )}
    </>
  );
};

type RedeemProps = DappState & {
  redeemTokens: () => void;
};
const Redeem = ({
  selectedAddress,
  impishTokenBalance,
  daoBalance,
  contractState,
  totalTokenSupply,
  redeemTokens,
}: RedeemProps) => {
  let title = "";

  if (contractState === 0) {
    title = "Paused";
  } else if (contractState === 2) {
    title = "Won";
  } else if (contractState === 3) {
    title = "Lost";
  }

  let ethRedeemable = BigNumber.from(0);
  if (
    impishTokenBalance !== undefined &&
    totalTokenSupply !== undefined &&
    daoBalance !== undefined &&
    daoBalance.gt(0)
  ) {
    ethRedeemable = impishTokenBalance.mul(daoBalance).div(totalTokenSupply);
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
                You have <br />
                <h4>{ethers.utils.formatEther(impishTokenBalance)} IMPISH Tokens</h4>
              </div>
              <div className="mb-3">
                which can be redeemed for
                <br />
                <h4>ETH {format4Decimals(ethRedeemable)}</h4>
              </div>
            </Col>
          </Row>
          {impishTokenBalance.gt(0) && (
            <Button variant="warning" onClick={() => redeemTokens()}>
              Redeem
            </Button>
          )}
        </>
      )}
    </>
  );
};

const Loading = () => {
  return (
    <>
      <h1>ImpishDAO is loading ...</h1>
    </>
  );
};

export function ImpishDAO(props: ImpishDAOProps) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const AdminDepositExternal = async () => {
    if (props.provider) {
      (await props.rwnft?.connect(props.provider.getSigner(0)).mint({ value: props.mintPrice })).wait().then(() => {
        props.readDappState();
        props.readUserData();
      });
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const AdminWithdraw = async () => {
    if (props.provider) {
      (await props.rwnft?.connect(props.provider.getSigner(0)).withdraw()).wait().then(() => {
        props.readDappState();
        props.readUserData();
      });
    }
  };

  const depositIntoDAO = async (amount: BigNumber) => {
    try {
      // Wait for this Tx to be mined, then refresh all data.
      let tx: ContractTransaction = await props.impdao?.deposit({ value: amount });

      // Wait for Tx confirmation
      await tx.wait();

      // Refresh data
      props.readDappState();
      props.readUserData();

      const bal = await props.impdao?.balanceOf(props.selectedAddress);

      props.showModal(
        "Yay!",
        <div>You successfully contributed and now have {ethers.utils.formatEther(bal)} IMPISH</div>
      );

      // Set a timer to refresh data after a few seconds, so that the server has time to process the event
      setTimeout(() => {
        props.readDappState();
        props.readUserData();
      }, 1000 * 5);
    } catch (e: any) {
      console.log(e);

      let msg: string | undefined;
      if (e?.data?.message?.includes("Too much ETH")) {
        msg = "You are depositing too much ETH. Please lower the amount and try again";
      } else if (e?.code === ERROR_CODE_TX_REJECTED_BY_USER) {
        // User cancelled, so do nothing
        msg = undefined;
      } else {
        msg = `Error: ${e?.data?.message}`;
      }

      if (msg) {
        props.showModal("Error Contributing to ImpishDAO!", <div>{msg}</div>);
      }
    }
  };

  const redeemTokens = async () => {
    // Wait for this Tx to be mined, then refresh all data.
    try {
      let tx: ContractTransaction = await props.impdao?.redeem();

      // Wait for Tx confirmation
      await tx.wait();

      // Refresh data
      props.readDappState();
      props.readUserData();

      props.showModal("Successfully Redeemed IMPISH!", <div>You successfully redeemed all your IMPISH.</div>);
    } catch (e: any) {
      console.log(e);

      // If user didn't cancel
      if (e?.code !== ERROR_CODE_TX_REJECTED_BY_USER) {
        props.showModal("Error Redeeming tokens!", <div>{e?.data?.message}</div>);
      }
    }
  };

  // Determine what to render on the main page
  let renderScreen = 0;

  // If state has loaded
  if (props.contractState !== undefined) {
    if (props.isRoundFinished || props.contractState !== 1) {
      renderScreen = 1; // Redeem page, since the round is finished or contract is not playable
    } else {
      let now = BigNumber.from(timeNow).div(1000);
      if (props.lastMintTime && now.sub(props.lastMintTime).toNumber() > 3600 * 24 * 30) {
        // 1 month
        renderScreen = 2; // We are about to win!
      } else {
        if (props.areWeWinning) {
          renderScreen = 3; // We are winning, but not yet won!
        } else {
          renderScreen = 4; // We are loosing, but not yet lost!
        }
      }
    }
  }

  let myShareOfWinnings = BigNumber.from(0);
  if (
    props.selectedAddress &&
    props.impishTokenBalance &&
    props.withdrawalAmount &&
    props.daoBalance &&
    props.totalTokenSupply &&
    props.totalTokenSupply.gt(0)
  ) {
    myShareOfWinnings = props.impishTokenBalance
      .mul(props.withdrawalAmount.add(props.daoBalance))
      .div(props.totalTokenSupply);
  }

  return (
    <>
      <Navigation {...props} />

      <Routes>
        <Route
          path=""
          element={
            <>
              <div className="withBackground" style={{ textAlign: "center", marginTop: "-50px", paddingTop: "100px" }}>
                {renderScreen === 4 && (
                  <BeenOutbid {...props} depositIntoDAO={depositIntoDAO} connectWallet={props.connectWallet} />
                )}
                {renderScreen === 3 && (
                  <WeAreWinning {...props} depositIntoDAO={depositIntoDAO} connectWallet={props.connectWallet} />
                )}
                {renderScreen === 2 && (
                  <WeWon {...props} depositIntoDAO={depositIntoDAO} connectWallet={props.connectWallet} />
                )}
                {renderScreen === 1 && <Redeem {...props} redeemTokens={redeemTokens} />}
                {renderScreen === 0 && <Loading />}
                <h4 className="mt-5">
                  <Link to="/impishdao/buy" style={{color: "#ffc106"}}>
                    {props.nftsWithPrice.length} RandomWalk NFTs are available!
                  </Link>
                </h4>
              </div>

              <Row className="mb-5 mt-5" style={{ textAlign: "center", backgroundColor: "#222", padding: "20px" }}>
                <h1>ImpishDAO Stats</h1>
              </Row>
              <Row className="justify-content-md-center mb-4">
                <Col md={4}>
                  <Table style={{ color: "white" }}>
                    <tbody>
                      <tr>
                        <td>DAO Balance</td>
                        <td>ETH {format4Decimals(props.daoBalance)}</td>
                      </tr>
                      <tr>
                        <td>RandomWalkNFT Prize</td>
                        <td>ETH {format4Decimals(props.withdrawalAmount)}</td>
                      </tr>
                      <tr>
                        <td>Next RandomWalkNFT Price</td>
                        <td>ETH {format4Decimals(props.mintPrice)}</td>
                      </tr>
                      <tr>
                        <td>Total IMPISH Supply</td>
                        <td>IMPISH {format4Decimals(props.totalTokenSupply)}</td>
                      </tr>
                    </tbody>
                  </Table>
                </Col>

                {props.selectedAddress && (
                  <Col md={4}>
                    <Table style={{ color: "white" }}>
                      <tbody>
                        <tr>
                          <td>Your IMPISH Balance</td>
                          <td>IMPISH {format4Decimals(props.impishTokenBalance)}</td>
                        </tr>
                        <tr>
                          <td>Your share if ImpishDAO wins</td>
                          <td>ETH {format4Decimals(myShareOfWinnings)}</td>
                        </tr>
                      </tbody>
                    </Table>
                  </Col>
                )}
              </Row>
            </>
          }
        />

        <Route path="buy" element={<ImpishDAOBuyNFTs {...props} />} />

        <Route path="faq" element={<Whitepaper withdrawalAmount={props.withdrawalAmount || BigNumber.from(0)} />} />
      </Routes>
    </>
  );
}
