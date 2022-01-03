/* eslint-disable jsx-a11y/anchor-is-valid */
/* eslint-disable jsx-a11y/anchor-has-content */
import { Button, Card, Col, Row } from "react-bootstrap";
import { DappState } from "../AppState";
import { pad, range } from "./utils";
import { Web3Provider } from "@ethersproject/providers";
import { Contract, BigNumber } from "ethers";
import { useEffect, useState } from "react";
import { Navigation } from "./Navigation";
import { cloneDeep } from "lodash";

type StakingPageDisplayProps = {
  title: string;
  pageSize: number;
  spirals: Array<SpiralDetail | BigNumber>;
  buttonName: string;
  onButtonClick: (selection: Set<number>) => void;
  secondButtonName?: string;
  onSecondButtonClick?: (selection: Set<number>) => void;
};
const StakingPageDisplay = ({
  pageSize,
  spirals,
  buttonName,
  title,
  onButtonClick,
  secondButtonName,
  onSecondButtonClick,
}: StakingPageDisplayProps) => {
  const [startPage, setStartPage] = useState(0);
  const [selection, setSelection] = useState<Set<number>>(new Set());

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

  const numPages = Math.floor(spirals.length / pageSize) + 1;

  const PageList = () => {
    return (
      <>
        <Row style={{marginTop: '20px'}}>
          
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

  const disabled = spirals.length === 0;

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
        {spirals.length === 0 && <span style={{ color: "#aaa", textAlign: "center" }}>Nothing Staked</span>}
      </Row>
      <Row>
        <div style={{display: 'flex', justifyContent: 'end', flexDirection: 'row'}}>
          <div>(Selected: {selection.size} / {spirals.length})</div>
        </div>
      </Row>
      <Row>
        <div style={{ display: "flex", justifyContent: "end", padding: "10px", gap: "10px" }}>
          {secondButtonName && onSecondButtonClick && (
            <Button variant="info" onClick={() => onSecondButtonClick(selection)} disabled={disabled}>
              {secondButtonName}
            </Button>
          )}
          <Button variant="info" onClick={() => onButtonClick(selection)} disabled={disabled || selection.size === 0}>
            {buttonName}
          </Button>
        </div>
      </Row>
    </>
  );
};

type SpiralStakingProps = DappState & {
  provider?: Web3Provider;
  impdao?: Contract;
  rwnft?: Contract;
  impspiral?: Contract;
  multimint?: Contract;
  spiralstaking?: Contract;
  rwnftstaking?: Contract;

  connectWallet: () => void;

  readDappState: () => Promise<void>;
  readUserData: () => Promise<void>;
  showModal: (title: string, message: JSX.Element, modalCloseCallBack?: () => void) => void;
};

type SpiralDetail = {
  tokenId: BigNumber;
  seed: string;
};

export function SpiralStaking(props: SpiralStakingProps) {
  const [walletSpirals, setWalletSpirals] = useState<Array<SpiralDetail>>([]);
  const [walletStakedSpirals, setWalletStakedSpirals] = useState<Array<SpiralDetail>>([]);

  const [walletRWNFTs, setWalletRWNFTs] = useState<Array<BigNumber>>([]);
  const [walletStakedRWNFTs, setWalletStakedRWNFTs] = useState<Array<BigNumber>>([]);

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
    if (props.selectedAddress) {
      fetch(`/spiralapi/wallet/${props.selectedAddress}`)
        .then((r) => r.json())
        .then(async (data) => {
          setWalletSpirals(await getSeedsForSpiralTokenIds(data));
        });
    }

    (async () => {
      // Get the list of staked spirals for the address directly.
      if (props.selectedAddress && props.spiralstaking) {
        const stakedTokenIds = (await props.spiralstaking.walletOfOwner(props.selectedAddress)) as Array<BigNumber>;
        setWalletStakedSpirals(await getSeedsForSpiralTokenIds(stakedTokenIds));
      }
    })();
  }, [props.selectedAddress, props.spiralstaking]);

  useEffect(() => {
    (async () => {
      if (props.selectedAddress && props.rwnftstaking && props.rwnft) {
        const stakedTokenIds = (await props.rwnftstaking.walletOfOwner(props.selectedAddress)) as Array<BigNumber>;
        console.log("Staked RWNFTs: ");
        console.log(stakedTokenIds);
        setWalletStakedRWNFTs(stakedTokenIds);

        const walletTokenIds = (await props.rwnft.walletOfOwner(props.selectedAddress)) as Array<BigNumber>;
        console.log("Wallet RWNFTS:");
        console.log(walletTokenIds);
        setWalletRWNFTs(walletTokenIds);
      }
    })();
  }, [props.selectedAddress, props.rwnft, props.rwnftstaking]);

  const stakeSpirals = async (spiralTokenIds: Set<number>) => {
    if (props.spiralstaking && props.impspiral && spiralTokenIds.size > 0) {
      // First, check if approved
      if (!(await props.impspiral.isApprovedForAll(props.selectedAddress, props.spiralstaking.address))) {
        const tx = await props.impspiral.setApprovalForAll(props.spiralstaking.address, true);
        await tx.wait();
      }

      const tokenIds = Array.from(spiralTokenIds).map((t) => BigNumber.from(t));
      const tx = await props.spiralstaking.stakeNFTs(tokenIds);
      await tx.wait();
    }
  };

  const unstakeSpirals = async (spiralTokenIds: Set<number>) => {
    console.log(`Un Staking ${Array.from(spiralTokenIds)}`);

    if (props.spiralstaking) {
      const tokenIds = Array.from(spiralTokenIds).map((t) => BigNumber.from(t));
      const tx = await props.spiralstaking.unstakeNFTs(tokenIds, true);
      await tx.wait();
    }
  };

  const stakeRWNFTs = async (rwTokenIds: Set<number>) => {
    console.log(`Staking ${Array.from(rwTokenIds)}`);
    console.log(props.rwnft);

    if (props.rwnftstaking && props.rwnft && rwTokenIds.size > 0) {
      // First, check if approved
      if (!(await props.rwnft.isApprovedForAll(props.selectedAddress, props.rwnftstaking.address))) {
        const tx = await props.rwnft.setApprovalForAll(props.rwnftstaking.address, true);
        await tx.wait();
      }

      const tokenIds = Array.from(rwTokenIds).map((t) => BigNumber.from(t));
      const tx = await props.rwnftstaking.stakeNFTs(tokenIds);
      await tx.wait();
    }
  };

  const unstakeRWNFTs = async (rwTokenIds: Set<number>) => {
    console.log(`Un Staking ${Array.from(rwTokenIds)}`);

    if (props.rwnftstaking) {
      const tokenIds = Array.from(rwTokenIds).map((t) => BigNumber.from(t));
      const tx = await props.rwnftstaking.unstakeNFTs(tokenIds, true);
      await tx.wait();
    }
  };

  const claimSpiralbits = async (contractNum: number) => {
    if (props.rwnftstaking && contractNum === 1) {
      const tx = await props.rwnftstaking.unstakeNFTs([], true);
      await tx.wait();
    } else if (props.spiralstaking && contractNum === 0) {
      const tx = await props.spiralstaking.unstakeNFTs([], true);
      await tx.wait();
    }
  };

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
                  buttonName="Stake"
                  pageSize={6}
                  spirals={walletSpirals}
                  onButtonClick={stakeSpirals}
                />
              )}
              {props.selectedAddress && (
                <StakingPageDisplay
                  title="Staked Spirals"
                  buttonName="UnStake"
                  pageSize={6}
                  spirals={walletStakedSpirals}
                  onButtonClick={unstakeSpirals}
                  secondButtonName="Claim SPIRALBITS"
                  onSecondButtonClick={() => claimSpiralbits(0)}
                />
              )}
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
                  buttonName="Stake"
                  pageSize={6}
                  spirals={walletRWNFTs}
                  onButtonClick={stakeRWNFTs}
                />
              )}
              {props.selectedAddress && (
                <StakingPageDisplay
                  title="Staked RandomWalkNFTs"
                  buttonName="UnStake"
                  pageSize={6}
                  spirals={walletStakedRWNFTs}
                  onButtonClick={unstakeRWNFTs}
                  secondButtonName="Claim SPIRALBITS"
                  onSecondButtonClick={() => claimSpiralbits(1)}
                />
              )}
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
            <span style={{ fontWeight: "bold", color: "#ffd454" }}>When does staking launch?</span>
            <br />
            Staking your Spirals and RandomWalkNFTs will both be available starting Jan 4th 2022, 9AM EST / 5PM UTC.
          </div>
        </Col>
      </Row>
    </>
  );
}
