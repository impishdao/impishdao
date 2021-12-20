import { BigNumber } from "ethers";
import { useEffect, useState } from "react";
import { Button, Card, Col, Container, Nav, Navbar, Row } from "react-bootstrap";
import { LinkContainer } from "react-router-bootstrap";
import { useNavigate, useParams } from "react-router-dom";
import { DappState } from "../AppState";
import { format4Decimals } from "./utils";

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

  return (
    <>
      <Navbar fixed="top" style={{ borderBottom: "1px solid #fff" }} variant="dark" bg="dark">
        <Container>
          <Navbar.Brand href="/">ImpishDAO</Navbar.Brand>
          <Nav className="me-auto">
            <LinkContainer to="/">
              <Nav.Link>Home</Nav.Link>
            </LinkContainer>
            <div className="vr" style={{ marginLeft: "10px", marginRight: "10px" }}></div>
            <LinkContainer to="/spirals">
              <Nav.Link>Spirals</Nav.Link>
            </LinkContainer>
            {props.selectedAddress && (
              <LinkContainer to={`/spirals/wallet/${props.selectedAddress}`}>
                <Nav.Link>Your Wallet</Nav.Link>
              </LinkContainer>
            )}
          </Nav>
          {!props.selectedAddress && (
            <Button className="connect" variant="warning" onClick={props.connectWallet}>
              Connect Wallet
            </Button>
          )}
          {props.selectedAddress && (
            <>
              <div style={{ marginRight: "10px" }}>Wallet: {format4Decimals(props.tokenBalance)} IMPISH</div>
              <Button className="address" variant="warning">
                {props.selectedAddress}
              </Button>
            </>
          )}
        </Container>
      </Navbar>

      <div style={{ textAlign: "center", marginTop: "-50px", paddingTop: "100px" }}>
        <h1>Spirals owned by</h1>
        <h5 style={{ color: "#ffd454" }}>{address}</h5>

        <Container>
          <Row className="mt-5 mb-5">
            {spirals.map((s) => {
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
        </Container>
      </div>
    </>
  );
}
