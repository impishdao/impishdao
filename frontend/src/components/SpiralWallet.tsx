import { BigNumber } from "ethers";
import { useEffect, useState } from "react";
import { Card, Col, Container, Row } from "react-bootstrap";
import { useNavigate, useParams } from "react-router-dom";
import { DappContracts, DappState, SpiralDetail } from "../AppState";
import { Navigation } from "./Navigation";
import { range, retryTillSucceed } from "./utils";

type SpiraWalletProps = DappState &
  DappContracts & {
    connectWallet: () => void;
  };

const getSeedsForSpiralTokenIds = async (tokenIds: Array<BigNumber>): Promise<Array<SpiralDetail>> => {
  const spiralDetails = await Promise.all(
    tokenIds.map(async (t) => {
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
  filtered.sort((a, b) => b.tokenId.toNumber() - a.tokenId.toNumber());

  return filtered;
};

export function SpiralWallet(props: SpiraWalletProps) {
  const { address } = useParams();
  const [spirals, setSpirals] = useState<Array<SpiralDetail>>([]);
  const [stakedSpirals, setStakedSpirals] = useState<Array<SpiralDetail>>([]);
  const [startPage, setStartPage] = useState(0);

  useEffect(() => {
    // Fetch wallet's directly owned spirals
    fetch(`/spiralapi/wallet/${address}`)
      .then((r) => r.json())
      .then((data) => {
        (async () => {
          const spiralDetails = await getSeedsForSpiralTokenIds(data);
          setSpirals(spiralDetails);
        })();
      });

    // Get staked spirals
    fetch(`/spiralapi/stakedwallet/${address}`)
      .then((r) => r.json())
      .then((data) => {
        (async () => {
          const spiralDetails = await getSeedsForSpiralTokenIds(data);
          setStakedSpirals(spiralDetails);
        })();
      });
  }, [address]);

  const allSpirals = spirals.concat(stakedSpirals);

  const nav = useNavigate();
  const PAGE_SIZE = 12;
  const numPages = Math.floor(allSpirals.length / PAGE_SIZE) + 1;

  const PageList = () => {
    return (
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
    );
  };

  return (
    <>
      <Navigation {...props} />

      <div style={{ textAlign: "center", marginTop: "-50px", paddingTop: "100px" }}>
        <h1>Spirals owned by</h1>
        <h5 style={{ color: "#ffd454" }}>{address}</h5>

        <Container className="mt-5 mb-5">
          <PageList />
          <Row>
            {allSpirals.slice(startPage * PAGE_SIZE, startPage * PAGE_SIZE + PAGE_SIZE).map((s) => {
              const imgurl = `/spiral_image/seed/${s.seed}/300.png`;
              return (
                <Col md={4} key={s.seed} className="mb-3">
                  <Card
                    style={{ width: "320px", padding: "10px", borderRadius: "5px", cursor: "pointer" }}
                    onClick={() => {
                      nav(`/spirals/detail/${s.tokenId.toString()}`);
                    }}
                  >
                    <Card.Img variant="top" src={imgurl} style={{ width: "300px", height: "300px" }} />
                    <Card.Body>
                      <Card.Title>
                        #{s.tokenId.toString()} {s.indirectOwner && <>(Staked)</>}
                      </Card.Title>
                    </Card.Body>
                  </Card>
                </Col>
              );
            })}
            {allSpirals.length === 0 && <Col xs={12}>Nothing here</Col>}
          </Row>
          <PageList />
        </Container>
      </div>
    </>
  );
}
