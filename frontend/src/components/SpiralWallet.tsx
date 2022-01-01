import { BigNumber } from "ethers";
import { useEffect, useState } from "react";
import { Card, Col, Container, Row } from "react-bootstrap";
import { useNavigate, useParams } from "react-router-dom";
import { DappState } from "../AppState";
import { Navigation } from "./Navigation";
import { format4Decimals, range } from "./utils";

type SpiraWalletProps = DappState & {
  connectWallet: () => void;
};

type SpiralDetail = {
  tokenId: BigNumber;
  seed: string;
};

export function SpiralWallet(props: SpiraWalletProps) {
  const { address } = useParams();
  const [spirals, setSpirals] = useState<Array<SpiralDetail>>([]);
  const [startPage, setStartPage] = useState(0);

  useEffect(() => {
    fetch(`/spiralapi/wallet/${address}`)
      .then((r) => r.json())
      .then((data) => {
        (async () => {
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
          setSpirals(filtered);
        })();
      });
  }, [address]);

  const nav = useNavigate();
  const PAGE_SIZE = 12;
  const numPages = Math.floor(spirals.length / PAGE_SIZE) + 1;

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
            {spirals.slice(startPage * PAGE_SIZE, startPage * PAGE_SIZE + PAGE_SIZE).map((s) => {
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
                      <Card.Title>#{s.tokenId.toString()}</Card.Title>
                    </Card.Body>
                  </Card>
                </Col>
              );
            })}
          </Row>
          <PageList />
        </Container>
      </div>
    </>
  );
}
