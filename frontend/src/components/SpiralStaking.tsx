/* eslint-disable jsx-a11y/anchor-is-valid */
/* eslint-disable jsx-a11y/anchor-has-content */
import { Button, Card, Col, OverlayTrigger, Row, Table, Tooltip } from "react-bootstrap";
import { DappState } from "../AppState";
import { formatkmb, pad, range, retryTillSucceed } from "./utils";
import { Web3Provider } from "@ethersproject/providers";
import { Contract, BigNumber } from "ethers";
import { useEffect, useState } from "react";
import { Navigation } from "./Navigation";
import { cloneDeep } from "lodash";
import { Link } from "react-router-dom";

type StakingPageDisplayProps = {
  title: string;
  pageSize: number;
  spirals?: Array<SpiralDetail | BigNumber>;
  buttonName: string;
  buttonTooltip?: string;
  onButtonClick: (selection: Set<number>) => void;
  secondButtonName?: string;
  secondButtonTooltip?: string;
  onSecondButtonClick?: (selection: Set<number>) => void;
  refreshCounter: number;
  nothingMessage?: JSX.Element;
};
const StakingPageDisplay = ({
  pageSize,
  spirals,
  title,
  buttonName,
  buttonTooltip,
  onButtonClick,
  secondButtonName,
  secondButtonTooltip,
  onSecondButtonClick,
  refreshCounter,
  nothingMessage,
}: StakingPageDisplayProps) => {
  const [startPage, setStartPage] = useState(0);
  const [selection, setSelection] = useState<Set<number>>(new Set());

  useEffect(() => {
    setSelection(new Set());
  }, [refreshCounter]);

  const toggleInSelection = (tokenNumber: number) => {
    if (selection.has(tokenNumber)) {
      const newSelection = cloneDeep(selection);
      newSelection.delete(tokenNumber);
      setSelection(newSelection);
    } else {
      const newSelection = cloneDeep(selection);
      newSelection.add(tokenNumber);
      setSelection(newSelection);
    }
  };

  const selectAll = () => {
    if (spirals && spirals.length > 0) {
      const newSelection = spirals.slice(0, 50).map((t: any) => {
        if (t.tokenId) {
          return t.tokenId.toNumber();
        } else {
          return t.toNumber();
        }
      });
      setSelection(new Set(newSelection));
    }
  };

  const numPages = spirals ? Math.floor(spirals.length / pageSize) + 1 : 1;

  const PageList = () => {
    return (
      <>
        <Row style={{ marginTop: "20px" }}>
          <h5>{title}</h5>
        </Row>
        <Row className="mb-2">
          {numPages > 1 && (
            <Col xs={{ span: 6, offset: 3 }}>
              <div style={{ display: "flex", flexDirection: "row", gap: "10px", justifyContent: "center" }}>
                Pages
                {range(numPages).map((p) => {
                  const textDecoration = p === startPage ? "underline" : "";
                  return (
                    <div key={p} style={{ cursor: "pointer" }} onClick={() => setStartPage(p)}>
                      <span style={{ textDecoration }}>{p}</span>
                    </div>
                  );
                })}
              </div>
            </Col>
          )}
        </Row>
      </>
    );
  };

  const disabled = !spirals || spirals.length === 0;

  return (
    <>
      <PageList />
      <Row
        style={{
          minHeight: "150px",
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {!spirals && <span style={{ color: "#aaa", textAlign: "center" }}>Loading...</span>}
        {spirals && (
          <>
            {spirals.slice(startPage * pageSize, startPage * pageSize + pageSize).map((s: any) => {
              let imgurl;
              let tokenId: BigNumber;
              let height;

              if (s.tokenId !== undefined) {
                imgurl = `/spiral_image/seed/${s.seed}/75.png`;
                tokenId = s.tokenId;
                height = "75px";
              } else {
                const paddedTokenId = pad(s.toString(), 6);
                imgurl = `https://randomwalknft.s3.us-east-2.amazonaws.com/${paddedTokenId}_black_thumb.jpg`;
                tokenId = s;
                height = "50px";
              }

              const border = selection.has(tokenId.toNumber()) ? "solid 2px #ffd454" : "solid 1px white";

              return (
                <Col md={2} key={tokenId.toNumber()} className="mb-3">
                  <Card
                    style={{ width: "90px", padding: "10px", borderRadius: "5px", cursor: "pointer", border }}
                    onClick={() => toggleInSelection(tokenId.toNumber())}
                  >
                    <Card.Img variant="top" src={imgurl} style={{ width: "75px", height }} />#{tokenId.toString()}
                  </Card>
                </Col>
              );
            })}
            {spirals.length === 0 && (
              <span style={{ color: "#aaa", textAlign: "center" }}>
                {nothingMessage !== undefined && <div>{nothingMessage}</div>}
                {nothingMessage === undefined && <span>Nothing Here</span>}
              </span>
            )}
          </>
        )}
      </Row>
      <Row>
        <div style={{ display: "flex", justifyContent: "end", flexDirection: "row" }}>
          {spirals && (
            <div style={{ display: "flex", flexDirection: "row", gap: "10px" }}>
              <div style={{ textDecoration: "underline", color: "white", cursor: "pointer" }} onClick={selectAll}>
                Select All
              </div>
              (Selected: {selection.size} / {spirals.length})
            </div>
          )}
        </div>
      </Row>
      <Row>
        <div style={{ display: "flex", justifyContent: "end", padding: "10px", gap: "10px" }}>
          {secondButtonName && onSecondButtonClick && (
            <OverlayTrigger placement="top" overlay={<Tooltip>{secondButtonTooltip || ""}</Tooltip>}>
              <Button variant="info" onClick={() => onSecondButtonClick(selection)} disabled={disabled}>
                {secondButtonName}
              </Button>
            </OverlayTrigger>
          )}
          <OverlayTrigger placement="top" overlay={<Tooltip>{buttonTooltip || ""}</Tooltip>}>
            <Button variant="info" onClick={() => onButtonClick(selection)} disabled={disabled || selection.size === 0}>
              {buttonName}
            </Button>
          </OverlayTrigger>
        </div>
      </Row>
    </>
  );
};

type SpiralStakingProps = DappState & {
  provider?: Web3Provider;
  spiralbits?: Contract;
  rwnft?: Contract;
  impspiral?: Contract;
  spiralstaking?: Contract;
  rwnftstaking?: Contract;

  connectWallet: () => void;

  readDappState: () => Promise<void>;
  readUserData: () => Promise<void>;
  showModal: (title: string, message: JSX.Element, modalCloseCallBack?: () => void) => void;
  showToast: (title: string, body: JSX.Element, autohide?: boolean) => number;
  hideToast: (id: number) => void;
};

type SpiralDetail = {
  tokenId: BigNumber;
  seed: string;
};

type SpiralBitsDetails = {
  pending: BigNumber;
  bonusBips: number;
};

export function SpiralStaking(props: SpiralStakingProps) {
  const [walletSpirals, setWalletSpirals] = useState<Array<SpiralDetail>>();
  const [walletStakedSpirals, setWalletStakedSpirals] = useState<Array<SpiralDetail>>();
  const [spiralsTokenInfo, setSpiralsTokenInfo] = useState<SpiralBitsDetails>();
  const [spiralStakingApprovalNeeded, setSpiralStakingApprovalNeeded] = useState(false);

  const [walletRWNFTs, setWalletRWNFTs] = useState<Array<BigNumber>>();
  const [walletStakedRWNFTs, setWalletStakedRWNFTs] = useState<Array<BigNumber>>();
  const [rwnftTokenInfo, setRWNFTTokenInfo] = useState<SpiralBitsDetails>();
  const [rwnftStakingApprovalNeeded, setRwnftStakingApprovalNeeded] = useState(false);

  const [refreshCounter, setRefreshCounter] = useState(0);

  const getSeedsForSpiralTokenIds = async (data: Array<BigNumber>): Promise<Array<SpiralDetail>> => {
    // Map all the data to get the seeds
    const spiralDetails = await Promise.all(
      (data as Array<BigNumber>).map(async (t) => {
        try {
          const tokenId = BigNumber.from(t);
          const url = `/spiralapi/seedforid/${tokenId.toString()}`;
          const { seed } = await (await fetch(url)).json();

          return { tokenId, seed };
        } catch (err) {
          console.log(err);
          return {};
        }
      })
    );

    const filtered = spiralDetails.filter((d) => d.seed) as Array<SpiralDetail>;
    return filtered;
  };

  useEffect(() => {
    // Update the user data, which contains the update-token-balances logic
    props.readUserData();
  }, [refreshCounter]);

  // Get Spiral staking info for the wallet
  useEffect(() => {
    if (props.selectedAddress) {
      fetch(`/spiralapi/wallet/${props.selectedAddress}`)
        .then((r) => r.json())
        .then(async (data) => {
          setWalletSpirals(await getSeedsForSpiralTokenIds(data));
        });
    }

    retryTillSucceed(async () => {
      if (props.selectedAddress && props.spiralstaking) {
        const stakedTokenIds = (await props.spiralstaking.walletOfOwner(props.selectedAddress)) as Array<BigNumber>;
        setWalletStakedSpirals(await getSeedsForSpiralTokenIds(stakedTokenIds));
      }
    });

    retryTillSucceed(async () => {
      if (props.selectedAddress && props.spiralstaking) {
        const pending = BigNumber.from(await props.spiralstaking.claimsPendingTotal(props.selectedAddress));
        const bonusBips = BigNumber.from(await props.spiralstaking.currentBonusInBips()).toNumber();
        setSpiralsTokenInfo({ pending, bonusBips });
      }
    });

    retryTillSucceed(async () => {
      if (props.selectedAddress && props.spiralstaking && props.impspiral) {
        setSpiralStakingApprovalNeeded(
          !(await props.impspiral.isApprovedForAll(props.selectedAddress, props.spiralstaking.address))
        );
      }
    });
  }, [props.selectedAddress, props.impspiral, props.spiralstaking, refreshCounter]);

  // Get RWNFT staking info for the wallet
  useEffect(() => {
    retryTillSucceed(async () => {
      if (props.selectedAddress && props.rwnftstaking) {
        const stakedTokenIds = (await props.rwnftstaking.walletOfOwner(props.selectedAddress)) as Array<BigNumber>;
        setWalletStakedRWNFTs(stakedTokenIds);
      }
    });

    retryTillSucceed(async () => {
      if (props.selectedAddress && props.rwnft) {
        const walletTokenIds = (await props.rwnft.walletOfOwner(props.selectedAddress)) as Array<BigNumber>;
        setWalletRWNFTs(walletTokenIds);
      }
    });

    retryTillSucceed(async () => {
      if (props.selectedAddress && props.rwnftstaking) {
        const pending = BigNumber.from(await props.rwnftstaking.claimsPendingTotal(props.selectedAddress));
        const bonusBips = BigNumber.from(await props.rwnftstaking.currentBonusInBips()).toNumber();
        setRWNFTTokenInfo({ pending, bonusBips });
      }
    });

    retryTillSucceed(async () => {
      if (props.selectedAddress && props.rwnft && props.rwnftstaking) {
        setRwnftStakingApprovalNeeded(
          !(await props.rwnft.isApprovedForAll(props.selectedAddress, props.rwnftstaking.address))
        );
      }
    });
  }, [props.selectedAddress, props.rwnft, props.rwnftstaking, refreshCounter]);

  const stakeSpirals = async (spiralTokenIds: Set<number>) => {
    if (props.spiralstaking && props.impspiral && spiralTokenIds.size > 0) {
      // First, check if approved
      if (spiralStakingApprovalNeeded) {
        const tx = await props.impspiral.setApprovalForAll(props.spiralstaking.address, true);
        const id = props.showToast("Approve Staking", <span>Waiting for confirmations...</span>);
        await tx.wait();
        props.hideToast(id);
      }

      const tokenIds = Array.from(spiralTokenIds).map((t) => BigNumber.from(t));
      const tx = await props.spiralstaking.stakeNFTs(tokenIds);
      const id = props.showToast("Staking", <span>Waiting for confirmations...</span>);
      await tx.wait();
      props.hideToast(id);

      setRefreshCounter(refreshCounter + 1);
    }
  };

  const unstakeSpirals = async (spiralTokenIds: Set<number>) => {
    if (props.spiralstaking) {
      const beforeSpiralBits = props.spiralBitsBalance;

      const tokenIds = Array.from(spiralTokenIds).map((t) => BigNumber.from(t));
      const tx = await props.spiralstaking.unstakeNFTs(tokenIds, true);
      const id = props.showToast("Unstaking", <span>Waiting for confirmations...</span>);
      await tx.wait();
      props.hideToast(id);

      setRefreshCounter(refreshCounter + 1);
      if (props.spiralbits && props.selectedAddress) {
        const afterSpiralBits = await props.spiralbits.balanceOf(props.selectedAddress);
        if (afterSpiralBits.gt(beforeSpiralBits)) {
          props.showModal(
            "Claimed SPIRALBITS",
            <div>
              You successfully claimed {formatkmb(afterSpiralBits.sub(beforeSpiralBits))} SPIRALBITS into your wallet.
            </div>
          );
        }
      }
    }
  };

  const stakeRWNFTs = async (rwTokenIds: Set<number>) => {
    if (props.rwnftstaking && props.rwnft && rwTokenIds.size > 0) {
      // First, check if approved
      if (rwnftStakingApprovalNeeded) {
        const tx = await props.rwnft.setApprovalForAll(props.rwnftstaking.address, true);
        const id = props.showToast("Approve Staking", <span>Waiting for confirmations...</span>);
        await tx.wait();
        props.hideToast(id);
      }

      const tokenIds = Array.from(rwTokenIds).map((t) => BigNumber.from(t));
      const tx = await props.rwnftstaking.stakeNFTs(tokenIds);
      const id = props.showToast("Stake RandomWalkNFTs", <span>Waiting for confirmations...</span>);
      await tx.wait();
      props.hideToast(id);

      setRefreshCounter(refreshCounter + 1);
    }
  };

  const unstakeRWNFTs = async (rwTokenIds: Set<number>) => {
    if (props.rwnftstaking) {
      const beforeSpiralBits = props.spiralBitsBalance;

      const tokenIds = Array.from(rwTokenIds).map((t) => BigNumber.from(t));
      const tx = await props.rwnftstaking.unstakeNFTs(tokenIds, true);
      const id = props.showToast("Unstaking", <span>Waiting for confirmations...</span>);
      await tx.wait();
      props.hideToast(id);

      setRefreshCounter(refreshCounter + 1);

      if (props.spiralbits && props.selectedAddress) {
        const afterSpiralBits = await props.spiralbits.balanceOf(props.selectedAddress);
        if (afterSpiralBits.gt(beforeSpiralBits)) {
          props.showModal(
            "Claimed SPIRALBITS",
            <div>
              You successfully claimed {formatkmb(afterSpiralBits.sub(beforeSpiralBits))} SPIRALBITS into your wallet.
            </div>
          );
        }
      }
    }
  };

  const claimSpiralbits = async (contractNum: number) => {
    const beforeSpiralBits = props.spiralBitsBalance;

    let tx;
    if (props.rwnftstaking && contractNum === 1) {
      tx = await props.rwnftstaking.unstakeNFTs([], true);
    } else if (props.spiralstaking && contractNum === 0) {
      tx = await props.spiralstaking.unstakeNFTs([], true);
    }

    const id = props.showToast("Claim SPIRALBITS", <span>Waiting for confirmations...</span>);
    await tx.wait();
    props.hideToast(id);

    setRefreshCounter(refreshCounter + 1);

    if (props.spiralbits && props.selectedAddress) {
      const afterSpiralBits = await props.spiralbits.balanceOf(props.selectedAddress);
      if (afterSpiralBits.gt(beforeSpiralBits)) {
        props.showModal(
          "Claimed SPIRALBITS",
          <div>
            You successfully claimed {formatkmb(afterSpiralBits.sub(beforeSpiralBits))} SPIRALBITS into your wallet.
          </div>
        );
      }
    }
  };

  let totalSpiralWithdrawWithBonus;
  if (spiralsTokenInfo?.pending) {
    const p = spiralsTokenInfo.pending;
    totalSpiralWithdrawWithBonus = p.add(p.mul(spiralsTokenInfo.bonusBips).div(10000));
  }

  let totalRWNFTWithdrawWithBonus;
  if (rwnftTokenInfo?.pending) {
    const p = rwnftTokenInfo.pending;
    totalRWNFTWithdrawWithBonus = p.add(p.mul(rwnftTokenInfo.bonusBips).div(10000));
  }

  return (
    <>
      <Navigation {...props} />

      <div
        className="withSpiralBackgroundMultiSpiral"
        style={{ textAlign: "center", marginTop: "-50px", paddingTop: "100px" }}
      >
        <h1 className="mb-5">Chapter 2: SpiralBits Staking</h1>

        {props.selectedAddress && (
          <Row>
            <Col md={6} style={{ border: "solid 1px white", textAlign: "left" }}>
              <h2
                style={{
                  textAlign: "center",
                  backgroundColor: "rgba(0, 0, 0, 0.5)",
                  padding: "10px",
                  color: "#ffd454",
                }}
              >
                Stake Spirals
              </h2>
              {props.selectedAddress && (
                <StakingPageDisplay
                  title="Available To Stake"
                  buttonName={spiralStakingApprovalNeeded ? "Approve & Stake" : "Stake"}
                  pageSize={6}
                  spirals={walletSpirals}
                  onButtonClick={stakeSpirals}
                  refreshCounter={refreshCounter}
                  nothingMessage={
                    <div>
                      No Spirals.{" "}
                      <Link to="/spirals" style={{ color: "#ffd454" }}>
                        Mint some to stake
                      </Link>
                    </div>
                  }
                />
              )}
              {props.selectedAddress && (
                <StakingPageDisplay
                  title="Staked Spirals"
                  buttonName="Unstake &amp; Claim"
                  buttonTooltip="Unstake selected Spirals and claim all SPIRALBITS into your wallet"
                  pageSize={6}
                  spirals={walletStakedSpirals}
                  onButtonClick={unstakeSpirals}
                  secondButtonName="Claim"
                  secondButtonTooltip="Claim all SPIRALBITS into your wallet without unstaking any Spirals"
                  refreshCounter={refreshCounter}
                  onSecondButtonClick={() => claimSpiralbits(0)}
                />
              )}
              <Table variant="dark">
                <tbody>
                  <tr>
                    <td>SPIRALBITS earned:</td>
                    <td style={{ textAlign: "right" }}>{formatkmb(spiralsTokenInfo?.pending)} SPIRALBITS</td>
                  </tr>
                  <tr>
                    <td>Current Bonus</td>
                    <td style={{ textAlign: "right" }}>{(spiralsTokenInfo?.bonusBips || 0) / 100} %</td>
                  </tr>
                  <tr>
                    <td>Total if withdrawn now:</td>
                    <td style={{ textAlign: "right" }}>{formatkmb(totalSpiralWithdrawWithBonus)} SPIRALBITS</td>
                  </tr>
                </tbody>
              </Table>
            </Col>

            <Col md={6} style={{ border: "solid 1px white", textAlign: "left" }}>
              <h2
                style={{
                  textAlign: "center",
                  backgroundColor: "rgba(0, 0, 0, 0.5)",
                  padding: "10px",
                  color: "#ffd454",
                }}
              >
                Stake RandomWalkNFTs
              </h2>
              {props.selectedAddress && (
                <StakingPageDisplay
                  title="Available To Stake"
                  buttonName={rwnftStakingApprovalNeeded ? "Approve & Stake" : "Stake"}
                  pageSize={6}
                  spirals={walletRWNFTs}
                  refreshCounter={refreshCounter}
                  onButtonClick={stakeRWNFTs}
                  nothingMessage={
                    <div>
                      No RandomWalkNFTs.{" "}
                      <a
                        href="https://www.randomwalknft.com/"
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#ffd454" }}
                      >
                        Mint some to stake
                      </a>
                    </div>
                  }
                />
              )}
              {props.selectedAddress && (
                <StakingPageDisplay
                  title="Staked RandomWalkNFTs"
                  buttonName="Unstake &amp; Claim"
                  buttonTooltip="Unstake selected RandomWalkNFTs and claim all SPIRALBITS into your wallet"
                  pageSize={6}
                  spirals={walletStakedRWNFTs}
                  onButtonClick={unstakeRWNFTs}
                  secondButtonTooltip="Claim all SPIRALBITS into your wallet without unstaking any RandomWalkNFTs"
                  secondButtonName="Claim"
                  refreshCounter={refreshCounter}
                  onSecondButtonClick={() => claimSpiralbits(1)}
                />
              )}
              <Table variant="dark">
                <tbody>
                  <tr>
                    <td>SPIRALBITS earned:</td>
                    <td style={{ textAlign: "right" }}>{formatkmb(rwnftTokenInfo?.pending)} SPIRALBITS</td>
                  </tr>
                  <tr>
                    <td>Current Bonus</td>
                    <td style={{ textAlign: "right" }}>{(rwnftTokenInfo?.bonusBips || 0) / 100} %</td>
                  </tr>
                  <tr>
                    <td>Total if withdrawn now:</td>
                    <td style={{ textAlign: "right" }}>{formatkmb(totalRWNFTWithdrawWithBonus)} SPIRALBITS</td>
                  </tr>
                </tbody>
              </Table>
            </Col>
          </Row>
        )}
        {!props.selectedAddress && (
          <div style={{ marginTop: "50px", marginBottom: "100px" }}>
            <div>
              Connect your Metamask wallet
              <br />
              to start staking Spirals and RandomWalkNFTs
            </div>
            <a href="#faq" className="mb-5" style={{ color: "#ffc106" }}>
              What is Spiral Staking?
            </a>
            <br />
            <Button className="connect mt-4" variant="warning" onClick={props.connectWallet}>
              Connect Wallet
            </Button>
          </div>
        )}
      </div>

      <a id="faq"></a>
      <Row className="mb-5 mt-5" style={{ textAlign: "center", backgroundColor: "#222", padding: "20px" }}>
        <h1>Staking FAQ</h1>
      </Row>
      <Row className="justify-content-md-center">
        <Col md={8}>
          <div className="mb-3">
            <span style={{ fontWeight: "bold", color: "#ffd454" }}>How does the Staking work?</span>
            <br />
            "Chapter 2: The SpiralBits" lets you stake your Impish Spiral NFTs and your RandomWalkNFTs to earn
            SPIRALBITS tokens. Staking is the process of depositing your Impish Spiral or RandomWalkNFT into a staking
            contract, and earning a stream of SPIRALBITS tokens for the duration that the NFTs are kept in the staking
            contracts.
            <br />
            <br />
            SPIRALBITS is an ERC-20 token on Arbitrum, and the currency that will be used throughout the rest of the
            Impish Chapters.
            <br />
            Staking a Impish Spiral earns you a 10 SPIRALBITS per minute or 14.4K SPIRALBITS per day. Staking a
            RandomWalkNFT earns you 1 SPIRALBITS per minute, or 1.4K SPIRALBITS per day.
            <br />
            <br />
            You can stake, unstake and/or withdraw your accumulated SPIRALBITS at any time, there are no lockins.
            However, you might need to carefully plan your staking and withdrawal strategy to take advantage of the
            SPIRALBITS bonuses.
          </div>

          <div className="mb-3">
            <span style={{ fontWeight: "bold", color: "#ffd454" }}>What are the SPIRALBITS bonuses?</span>
            <br />
            At the moment you withdraw your accumulated SPIRALBITS, you are awarded a bonus, which is calculated as
            follows:
            <ul>
              <li>
                For staked Spirals - The percentage of RandomWalkNFTs staked at the time of the withdrawal determines
                your bonus percentage{" "}
              </li>
              <li>
                For staked RandomWalkNFTs - The percentage of Spirals staked at the time of the withdrawal determines
                your bonus percentage{" "}
              </li>
            </ul>
            <br />
            For example, if you have staked 1 Spiral, and have accumulated 100k SPIRALBITS so far, and you decide to
            withdraw your earned SPIRALBITS into your wallet. At the instant you withdraw, the staking contract
            determines what percentage of RandomWalkNFTs have been staked in Staking contract. Lets say 1000
            RandomWalkNFTs out of a total of 3608 RandomWalkNFTs are staked, your bonus percentage will be 1000 / 3608 =
            27.7%, so you will be awarded 27.7% extra SPIRALBITS, for a total of 100k + 27.7k = 127.7k SPIRALBITS.
            <br />
            <br />
            Similarly, if you have staked RandomWalkNFTs and have accumulated SPIRALBITS, at the instant you withdraw,
            the contract calculates the number of Spirals staked, divided by the total number of Spirals in existance,
            calculates the percentage, and awards that percentage of SPIRALBITS as the bonus.
          </div>

          <div className="mb-3">
            <span style={{ fontWeight: "bold", color: "#ffd454" }}>How can I buy SPIRABITS?</span>
            <br />
            Apart from Staking, you can also buy SPIRALBITS tokens on{" "}
            <a
              href="https://app.uniswap.org/#/swap?inputCurrency=ETH&outputCurrency=0x650A9960673688Ba924615a2D28c39A8E015fB19"
              target="_blank"
              rel="noreferrer"
              style={{ color: "white" }}
            >
              Uniswap
            </a>{" "}
            on Arbitrum.
          </div>

          <div className="mb-3">
            <span style={{ fontWeight: "bold", color: "#ffd454" }}>How many SPIRALBITS tokens will be issued?</span>
            <br />
            There will only be 2 Billion SPIRALBITS tokens.
            <br />
            <br />
            <ul>
              <li>100M tokens(5%) will be minted at start and put into a Uniswap V3 liquidity pool on Arbitrum</li>
              <li>~14k tokens per day will be issued per Staked Impish Spiral</li>
              <li>~1.4k tokens per day will be issued per Staked RandomWalkNFT</li>
              <li>
                Staking of SPIRALBITS itself will be enabled in the coming days, allowing you to compound your
                SPIRALBITS
              </li>
            </ul>
          </div>

          <div className="mb-3">
            <span style={{ fontWeight: "bold", color: "#ffd454" }}>
              When should I withdraw my accumulated SPIRALBITS
            </span>
            <br />
            Technically, you can withdraw your staked NFTs or accumulated SPIRALBITS at any time - there are no lockups.
            <br />
            <br />
            However, if you have staked Spirals, you might want to get as many other people staking RandomWalkNFTs as
            possible, which increases your bonus %.
            <br />
            <br />
            Similarly, if you have staked RandomWalkNFTs, you should encourage as many Spiral owners as you know to
            stake their Spirals, so you can get as large a bonus % as possible.
            <br />
            <br />
            Of course, if a very large % of Spirals and RandomWalkNFTs are staked, they are also earning SPIRALBITS,
            which might "dilute" your SPIRALBITS, so you need to decide what the best strategy for you is!
          </div>

          <div className="mb-3">
            <span style={{ fontWeight: "bold", color: "#ffd454" }}>What utility do SPIRALBITS have?</span>
            <br />
            SPIRALBITS are the utility token for the rest of the Impish Chapters. All details will be released 2nd week
            of Jan, but here's a sneak preview:
            <ul>
              <li>Impish Spiral + SPIRALBITS ==&gt; create an Impish Crystal </li>
              <li>Impish Crystal + SPIRALBITS ==&gt; grow your Crystal </li>
              <li>Impish Crystal ==shatter crystal==&gt; recover SPIRALBITS contained in the Crystal</li>
            </ul>
          </div>

          <div className="mb-3">
            <span style={{ fontWeight: "bold", color: "#ffd454" }}>Where are the contracts Deployed?</span>
            <br />
            SPIRALBITS is deployed as a normal ERC-20 token at &nbsp;
            <a
              href="https://arbiscan.io/address/0x650a9960673688ba924615a2d28c39a8e015fb19#code"
              rel="noreferrer"
              target="_blank"
              style={{ color: "white" }}
            >
              0x650A9960673688Ba924615a2D28c39A8E015fB19
            </a>
            &nbsp;
            <br />
            The Staking contracts for &nbsp;
            <a
              href="https://arbiscan.io/address/0xfa798e448db7987a5d7ab3620d7c3d5ecb18275e#code"
              rel="noreferrer"
              target="_blank"
              style={{ color: "white" }}
            >
              ImpishSpirals
            </a>{" "}
            &nbsp; and &nbsp;
            <a
              href="https://arbiscan.io/address/0xd9403e7497051b317cf1ae88eeaf46ee4e8ead68#code"
              rel="noreferrer"
              target="_blank"
              style={{ color: "white" }}
            >
              RandomWalkNFTs
            </a>{" "}
            &nbsp; are also deployed and verified on arbiscan.
          </div>
        </Col>
      </Row>
    </>
  );
}
