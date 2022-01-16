import { BigNumber } from "ethers";
import { useEffect, useState } from "react";
import { Card, Col, Container, Row } from "react-bootstrap";
import { useNavigate, useParams } from "react-router-dom";
import { CrystalInfo, DappContracts, DappState, SpiralDetail } from "../AppState";
import { crystal_image } from "../crystalRenderer";
import { Navigation } from "./Navigation";
import { range, retryTillSucceed } from "./utils";

type CrystalWalletProps = DappState &
  DappContracts & {
    connectWallet: () => void;
  };

const getMetadataForCrystalTokenIds = async (tokenIds: Array<BigNumber>): Promise<Array<CrystalInfo>> => {
  const crystalDetails = await Promise.all(
    tokenIds.map(async (t) => {
      try {
        const tokenId = BigNumber.from(t);
        const url = `/crystalapi/crystal/metadata/${tokenId.toString()}`;
        const { attributes } = await (await fetch(url)).json();

        const info = {
          tokenId,
          size: attributes.size,
          generation: attributes.generation,
          sym: attributes.sym,
          seed: BigNumber.from(attributes.seed),
          spiralBitsStored: BigNumber.from(attributes.spiralBitsStored),
          owner: attributes.owner,
        };

        return info;
      } catch (err) {
        console.log(err);
        return {};
      }
    })
  );

  const filtered = crystalDetails.filter((d: any) => d.seed) as Array<CrystalInfo>;
  filtered.sort((a, b) => b.tokenId.toNumber() - a.tokenId.toNumber());

  return filtered;
};

export function CrystalWallet(props: CrystalWalletProps) {
  const { address } = useParams();
  const [crystals, setCrystals] = useState<Array<CrystalInfo>>([]);
  const [startPage, setStartPage] = useState(0);

  useEffect(() => {
    // Fetch wallet's directly owned crystals
    fetch(`/crystalapi/wallet/${address}`)
      .then((r) => r.json())
      .then((data) => {
        (async () => {
          const crystalDetails = await getMetadataForCrystalTokenIds(data);
          setCrystals(crystalDetails);
        })();
      });
  }, [address]);

  const allSpirals = crystals;

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
        <h1>Crystals Owned By</h1>
        <h5 style={{ color: "#ffd454" }}>{address}</h5>

        <Container className="mt-5 mb-5">
          <PageList />
          <Row>
            {allSpirals.slice(startPage * PAGE_SIZE, startPage * PAGE_SIZE + PAGE_SIZE).map((s) => {
              return (
                <Col md={4} key={s.seed.toString()} className="mb-3">
                  <Card
                    style={{ width: "320px", padding: "10px", borderRadius: "5px", cursor: "pointer" }}
                    onClick={() => {
                      nav(`/crystals/detail/${s.tokenId.toString()}`);
                    }}
                  >
                    <Card.Img variant="top" src={crystal_image(s.seed.toHexString(), s.sym, s.generation, s.size/100)} style={{ width: "300px", height: "300px" }} />
                    <Card.Body>
                      <Card.Title>
                        #{s.tokenId.toString()}
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
