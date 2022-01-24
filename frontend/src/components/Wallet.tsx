import { useEffect, useState } from "react";
import { Card, Col, Container, Dropdown, Row } from "react-bootstrap";
import { useNavigate, useParams } from "react-router-dom";
import { CrystalInfo, DappState, SpiralDetail } from "../AppState";
import { crystal_image } from "../crystalRenderer";
import { Navigation } from "./Navigation";
import { formatkmb, range } from "./utils";
import { getMetadataForCrystalTokenIds, getSeedsForSpiralTokenIds } from "./walletutils";

type CrystalWalletProps = DappState & {
  connectWallet: () => void;
};

export function CrystalWallet(props: CrystalWalletProps) {
  const { type, address } = useParams();
  const [crystals, setCrystals] = useState<Array<CrystalInfo> | undefined>();
  const [spirals, setSpirals] = useState<Array<SpiralDetail>>([]);
  const [stakedSpirals, setStakedSpirals] = useState<Array<SpiralDetail>>([]);
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
  const allCrystals = crystals;

  const numItems = type === "spirals" ? allSpirals.length : allCrystals?.length || 0;

  const nav = useNavigate();
  const PAGE_SIZE = 12;
  const numPages = Math.floor(numItems / PAGE_SIZE) + 1;

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
        <h1>{type === "crystals" ? "Crystals" : "Spirals"} Owned By</h1>
        <h5 style={{ color: "#ffd454" }}>{address}</h5>

        <Row className="mb-5 mt-5" style={{ backgroundColor: "#222", padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              <div>Show</div>
              <Dropdown>
                <Dropdown.Toggle variant="warning" id="dropdown-basic">
                  {type === "crystals" ? "Crystals" : "Spirals"}
                </Dropdown.Toggle>

                <Dropdown.Menu>
                  <Dropdown.Item onClick={() => nav(`/wallet/${address}/spirals`)}>Spirals</Dropdown.Item>
                  <Dropdown.Item onClick={() => nav(`/wallet/${address}/crystals`)}>Crystals</Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div>{formatkmb(props.spiralBitsBalance)} SPIRALBITS</div>
              <div className="vr" style={{ marginLeft: "10px", marginRight: "10px" }}></div>
              <div>{formatkmb(props.impishTokenBalance)} IMPISH</div>
              <div className="vr" style={{ marginLeft: "10px", marginRight: "10px" }}></div>
              <div>{formatkmb(props.ethBalance)} ETH</div>
            </div>
          </div>
        </Row>

        <Container className="mt-5 mb-5">
          <PageList />
          <Row>
            {type === "crystals" && (
              <>
                {allCrystals &&
                  allCrystals.slice(startPage * PAGE_SIZE, startPage * PAGE_SIZE + PAGE_SIZE).map((s) => {
                    return (
                      <Col md={4} key={s.seed.toString()} className="mb-3">
                        <Card
                          style={{ width: "320px", padding: "10px", borderRadius: "5px", cursor: "pointer" }}
                          onClick={() => {
                            nav(`/crystals/detail/${s.tokenId.toString()}`);
                          }}
                        >
                          <Card.Img
                            variant="top"
                            src={crystal_image(s.seed.toHexString(), s.sym, s.generation, s.size / 100)}
                            style={{ width: "300px", height: "300px" }}
                          />
                          <Card.Body>
                            <Card.Title>#{s.tokenId.toString()}</Card.Title>
                          </Card.Body>
                        </Card>
                      </Col>
                    );
                  })}
                {allCrystals && allCrystals.length === 0 && <Col xs={12}>Nothing here</Col>}
                {allCrystals === undefined && <Col xs={12}>Loading...</Col>}
              </>
            )}

            {type === "spirals" && (
              <>
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
              </>
            )}
          </Row>
          <PageList />
        </Container>
      </div>
    </>
  );
}
