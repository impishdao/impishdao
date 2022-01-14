import { BigNumber, ethers } from "ethers";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button, Col, FloatingLabel, Form, Row } from "react-bootstrap";
import { Link } from "react-router-dom";
import { DappContracts, DappFunctions, DappState } from "../AppState";
import { setup_crystal } from "../crystalRenderer";
import { Navigation } from "./Navigation";
import { format4Decimals, range } from "./utils";

type Minted = {
  spiralId: BigNumber;
  minted: Array<number>;
};

type NextMintable = {
  gen: number;
  count: number;
  eachMintCost: BigNumber;
};

const mintCostsForEachGen = [
  BigNumber.from(0),
  ethers.utils.parseEther("0.01"),
  ethers.utils.parseEther("0.1"),
  ethers.utils.parseEther("1"),
  ethers.utils.parseEther("10"),
];

type CrystalsProps = DappState & DappFunctions & DappContracts & {};
export function Crystals(props: CrystalsProps) {
  const [numCrystals, setNumCrystals] = useState(1);
  const [mintableAtEachGen, setMintableAtEachGen] = useState<BigNumber[][]>([]);
  const [nextMintable, setNextMintable] = useState<NextMintable>({ gen: 0, count: 0, eachMintCost: BigNumber.from(0) });

  const [refreshCounter, setRefreshCounter] = useState(0);

  const countMintableAtEachGen = (minted: Minted[]) => {
    let mintableAtEachGen: Array<Array<BigNumber>> = [[], [], [], [], []];
    for (let i = 0; i < minted.length; i++) {
      for (let gen = 0; gen < 5; gen++) {
        if (!minted[i].minted[gen]) {
          mintableAtEachGen[gen].push(minted[i].spiralId);
        }
      }
    }

    return mintableAtEachGen;
  };

  useEffect(() => {
    if (props.selectedAddress) {
      fetch(`/crystalapi/getmintable/${props.selectedAddress}`)
        .then((d) => d.json())
        .then((j) => {
          const minted: Array<Minted> = [];

          for (let i = 0; i < j.length; i++) {
            minted.push({
              spiralId: BigNumber.from(j[i].spiralId),
              minted: j[i].minted,
            });
          }

          const mintable = countMintableAtEachGen(minted);

          // Find the first gen that is mintable
          for (let i = 0; i < 5; i++) {
            if (mintable[i].length > 0) {
              const gen = i;
              const count = mintable[i].length;
              const eachMintCost = mintCostsForEachGen[gen];
              setNextMintable({ gen, count, eachMintCost });
              break;
            }
          }
          setMintableAtEachGen(mintable);
        });
    }
  }, [props.selectedAddress, refreshCounter]);

  const mintCrystal = async () => {
    if (props.crystal) {
      // Mint numCrystals from the mintable list.
      const spiralTokenIds = mintableAtEachGen[nextMintable.gen].slice(0, numCrystals);
      const value = nextMintable.eachMintCost.mul(spiralTokenIds.length);

      await props.waitForTxConfirmation(
        props.crystal.mintCrystals(spiralTokenIds, nextMintable.gen, { value }),
        "Minting Crystals"
      );

      props.showModal(
        "Yay!",
        <div>You successfully minted {numCrystals} Crystals. You can now view them in your wallet.</div>,
        () => {
          // nav(`/spirals/detail/${id}`);
        }
      );
      setRefreshCounter(refreshCounter + 1);
    }
  };

  return (
    <>
      <Navigation {...props} />

      <Row style={{ textAlign: "center" }}>
        <h1 style={{ marginTop: "-50px", paddingTop: "100px" }}>Chapter 3: Impish Crystals</h1>
      </Row>
      <Row className="mb-2" style={{ textAlign: "center" }}>
        <div>
          You can mint {nextMintable.count} Gen {nextMintable?.gen} Impish Crystals
          {nextMintable.eachMintCost.eq(0) && <span> for Free!</span>}
          {nextMintable.eachMintCost.gt(0) && <span> at {format4Decimals(nextMintable.eachMintCost)} ETH each.</span>}
        </div>
      </Row>

      <Row className="justify-content-md-center">
        <Col xs={6} style={{ textAlign: "center" }}>
          <h5>Mint Impish Crystals</h5>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "flex-end",
              justifyContent: "center",
              gap: "10px",
            }}
          >
            <FloatingLabel label="Number of Crystals" style={{ color: "black", width: "200px" }}>
              <Form.Select
                value={numCrystals.toString()}
                onChange={(e) => setNumCrystals(parseInt(e.currentTarget.value))}
              >
                {range(nextMintable.count, 1).map((n) => {
                  return (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  );
                })}
              </Form.Select>
            </FloatingLabel>
            <Button style={{ marginTop: "10px", height: "58px" }} variant="warning" onClick={mintCrystal}>
              Mint for{" "}
              {nextMintable.eachMintCost.eq(0)
                ? "ETH 0"
                : `ETH ${format4Decimals(nextMintable.eachMintCost.mul(numCrystals))}`}
            </Button>
          </div>
        </Col>
      </Row>

      <Row className="mb-5" style={{ textAlign: "center", backgroundColor: "#222", padding: "20px" }}>
        <h1>FAQ</h1>
      </Row>
      <Row className="justify-content-md-center">
        <Col md={8}>
          <div className="mb-3">
            <span style={{ fontWeight: "bold", color: "#ffd454" }}>What are Impish Crystals?</span>
            <br />
            Impish Crystals are a new type of NFT on Arbitrum whose evolution you can control.
            <br />
            Crystals start off small, and need to be fed $SPIRALBITS tokens to grow. You can get $SPIRALBITS by{" "}
            <Link to="/spiralstaking" style={{ color: "white" }}>
              staking
            </Link>{" "}
            your Spirals/RandomWalkNFTs or on{" "}
            <a
              style={{ color: "white" }}
              href="https://app.uniswap.org/#/swap?inputCurrency=ETH&outputCurrency=0x650a9960673688ba924615a2d28c39a8e015fb19"
              target="_blank"
              rel="noreferrer"
            >
              Uniswap
            </a>
            .
          </div>

          <div className="mb-3">
            <span style={{ fontWeight: "bold", color: "#ffd454" }}>How can I mint Impish Crystals?</span>
            <br />
            Impish Crystals can only be minted by owners of Impish Spirals. If you don't have a Spiral yet, you can{" "}
            <Link to="/spirals" style={{ color: "white" }}>
              mint one
            </Link>{" "}
            or buy one on the{" "}
            <Link to="/spirals/marketplace" style={{ color: "white" }}>
              marketplace.
            </Link>
            <br />
            <br />
            Every Spiral can mint upto 5 Crystals.
            <ol>
              <li>The first crystal for every spiral is free!</li>
              <li>The second crystal costs ETH 0.01</li>
              <li>The third crystal costs ETH 0.1</li>
              <li>The fourth crystal costs ETH 1</li>
              <li>The fifth crystal costs ETH 10</li>
            </ol>
            All the ETH from minting the Crystals (after the first free Crystal) is sent to the developers to fund
            further development of ImpishDAO Chapters.
          </div>

          <div className="mb-3">
            <span style={{ fontWeight: "bold", color: "#ffd454" }}>What can I do with my Crystals?</span>
            <br />
            There are 4 things you can do with a Crystal.
            <ol>
              <li style={{ color: "#ffd454" }}>Grow</li>
              Each crystal starts out small, and can be grown by feeding it $SPIRALBITS tokens. The amount of
              $SPIRALBITS needed to grow a crystal depends on the number of Symmetries it has. Crystals start off with a
              size of 30, and can grow to a maximum size of 100. Half of the $SPIRALBITS used to grow Crystals are
              burned, and the rest are stored inside the crystal.
              <br />
              <br />
              <li style={{ color: "#ffd454" }}>Add Symmetry</li>
              Every crystal has a certain number of symmetries, usually between 5 and 8. You can add more symmetries by
              spending $SPIRALBITS, upto a maximum of 20 symmetries per Crystal.
              <br />
              <br /> Adding Symmetries means Crystals need more $SPIRALBITS to grow, but their capicity to store
              $SPIRALBITS also increases proportionally. Adding one symmetry costs 20k $SPIRALBITS. All the $SPIRALBITS
              used to add symmetries are burned.
              <br />
              <br />
              <li style={{ color: "#ffd454" }}>Reduce Symmetry</li>
              You can also reduce the number of symmetries your crystal has by spending $SPIRALBITS.
              <br />
              <br />
              Adding one symmetry costs 20k $SPIRALBITS. All the $SPIRALBITS used to add symmetries are burned.
              <br />
              <br />
              <li style={{ color: "#ffd454" }}>Shatter</li>
              Shattering a crystal burns the NFT permanently, recovering the $SPIRALBITS stored in the Crystal and
              sending it to the Crystal's owner. Shattering a crystal is irreversible!
            </ol>
            <br />
          </div>

          <div className="mb-3">
            <span style={{ fontWeight: "bold", color: "#ffd454" }}>
              How many $SPIRALBITS does it cost to grow a Crystal?
            </span>
            <br />
            When Crystals are first minted, they start off with a size of '30', and can be grown up to a maximum size of
            '100'. Growing a Crystal by 1 size costs 1000 $SPIRALBITS per Symmetry.
            <br />
            <br />
            For example, if you have a 6-Symmetry Crystal of size 30, growing it to size 50 will cost 6 * (50-30) * 1000
            = 120k SPIRALBITS. Therefore, fully growing a 6-Symmetry crystal from size 30 to size 100 costs 420k
            $SPIRALBITS, or 4 weeks worth of staking rewards for a single Spiral.
            <br />
            <br />
            In other words, if you have 1 Spiral Staked, you can mint a crystal and grow it to full size with
            approximately 4 weeks worth of staking rewards.
          </div>

          <div className="mb-3">
            <span style={{ fontWeight: "bold", color: "#ffd454" }}>
              What happens to all the $SPIRALBITS used to grow Crystals?
            </span>
            <br />
            Half of all $SPIRALBITS used to grow crystals are burned, and the other half are stored inside the Crystal.
            You can recover the stored $SPIRALBITS by shattering the crystal, but shattering a crystal burns it forever!
            <br />
            <br />
            Adding or Reducing Symmetries also costs $SPIRALBITS, and all the $SPIRALBITS used to add/reduce Symmetries
            are burned.
          </div>

          <div className="mb-3">
            <span style={{ fontWeight: "bold", color: "#ffd454" }}>What are future plans for Crystals?</span>
            <br />
            Staking for Crystals and buying/selling them in the marketplace is coming soon.
          </div>

          <div className="mb-3">
            <span style={{ fontWeight: "bold", color: "#ffd454" }}>
              Where can I get more $SPIRALBITS to speed up growth for my crystals?
            </span>
            <br />
            You can either:
            <ul>
              <li>Stake your Spirals and RandomWalkNFTs to earn a stream of $SPIRALBITS</li>
              <li>
                Buy $SPIRALBITS on{" "}
                <a
                  style={{ color: "white" }}
                  href="https://app.uniswap.org/#/swap?inputCurrency=ETH&outputCurrency=0x650a9960673688ba924615a2d28c39a8e015fb19"
                  target="_blank"
                  rel="noreferrer"
                >
                  Uniswap
                </a>{" "}
              </li>
            </ul>
          </div>
        </Col>
      </Row>
    </>
  );
}
