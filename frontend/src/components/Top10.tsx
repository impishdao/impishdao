import { BigNumber } from "ethers";
import { useEffect, useState } from "react";
import { Card, Col, Container, ListGroup, Row } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { DappState, SpiralsState } from "../AppState";
import { Navigation } from "./Navigation";
import { format4Decimals, formatUSD, range, secondsToDhms, THREE_DAYS, trimAddress } from "./utils";

type Top10Props = DappState & {
  connectWallet: () => void;
};

type SpiralDetail = {
  tokenId: BigNumber;
  seed: string;
  owner: string;
  indirectOwner?: string;
};

export function Top10(props: Top10Props) {
  const [spirals, setSpirals] = useState<Array<SpiralDetail>>([]);
  const [spiralState, setSpiralState] = useState<SpiralsState | undefined>();
  const [timeRemaining, setTimeRemaining] = useState(THREE_DAYS);

  // Countdown timer.
  useEffect(() => {
    const timerID = setInterval(() => {
      setTimeRemaining(timeRemaining - 60);
    }, 1000 * 60);

    return function cleanup() {
      clearInterval(timerID);
    };
  }, [timeRemaining]);

  useEffect(() => {
    fetch("/spiralapi/spiraldata")
      .then((data) => data.json())
      .then((j) => {
        const lastMintTime = BigNumber.from(j.lastMintTime || 0);
        const nextTokenId = BigNumber.from(j.nextTokenId || 0);
        const totalReward = BigNumber.from(j.totalReward || 0);

        setTimeRemaining(lastMintTime.toNumber() + THREE_DAYS - Date.now() / 1000);
        setSpiralState({ lastMintTime, nextTokenId, totalReward });

        (async () => {
          // Fetch the top 10 spirals
          const spiralDetails = await Promise.all(
            range(10, nextTokenId.toNumber() - 10).map(async (t) => {
              try {
                const tokenId = BigNumber.from(t);
                const url = `/spiralapi/seedforid/${tokenId.toString()}`;
                const { seed, owner, indirectOwner } = await (await fetch(url)).json();

                return { tokenId, seed, owner, indirectOwner };
              } catch (err) {
                console.log(err);
                return {};
              }
            })
          );

          const filtered = spiralDetails.filter((d) => d.seed) as Array<SpiralDetail>;
          filtered.reverse();
          setSpirals(filtered);
        })();
      });
  }, []);

  const nav = useNavigate();

  return (
    <>
      <Navigation {...props} />

      <div style={{ textAlign: "center", marginTop: "-50px", paddingTop: "100px" }}>
        <h1>Current Spiral Winners</h1>
        <div>if no new Spirals are minted in</div>
        <h3>{secondsToDhms(timeRemaining)}</h3>

        <Container className="mt-5 mb-5">
          <Row>
            {spirals.map((s, rank) => {
              const imgurl = `/spiral_image/seed/${s.seed}/300.png`;
              const rewardETH = spiralState?.totalReward.mul(10 - rank).div(100) || BigNumber.from(0);
              return (
                <Col md={4} key={s.seed} className="mb-3">
                  <Card
                    style={{ width: "320px", padding: "10px", borderRadius: "5px", cursor: "pointer" }}
                    onClick={() => {
                      nav(`/spirals/detail/${s.tokenId.toString()}`);
                    }}
                  >
                    <Card.Img variant="top" src={imgurl} style={{ width: "300px", height: "300px" }} />
                    <ListGroup variant="flush">
                      <ListGroup.Item
                        style={{ backgroundColor: "black", color: "white", borderBottom: "solid 1px white" }}
                      >
                        Rank #{rank + 1} (Spiral #{s.tokenId.toString()})
                      </ListGroup.Item>
                      <ListGroup.Item
                        style={{ backgroundColor: "black", color: "white", borderBottom: "solid 1px white" }}
                      >
                        <span>{s.indirectOwner ? "Staked" : "Owned"}</span> By:{" "}
                        {trimAddress(s.indirectOwner || s.owner)}
                      </ListGroup.Item>
                      <ListGroup.Item style={{ backgroundColor: "black", color: "white" }}>
                        Reward ETH {format4Decimals(rewardETH)}
                        {` ${formatUSD(rewardETH, props.lastETHPrice)}`}
                      </ListGroup.Item>
                    </ListGroup>
                  </Card>
                </Col>
              );
            })}
          </Row>
        </Container>
      </div>
    </>
  );
}
