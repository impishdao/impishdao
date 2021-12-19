import { useLayoutEffect, useRef, useState } from "react";
import { Button, Col, Container, Nav, Navbar, Row } from "react-bootstrap";
import { LinkContainer } from "react-router-bootstrap";
import { useParams } from "react-router-dom";
import { DappState } from "../AppState";
import { setup_image } from "../spiralRenderer";
import { format4Decimals } from "./utils";

type SpiralDetailProps = DappState & {
  connectWallet: () => void;
};

export function SpiralDetail(props: SpiralDetailProps) {
  const { id } = useParams();
  const canvasDetailRef = useRef<HTMLCanvasElement>(null);

  const [seed, setSeed] = useState("");
  const [owner, setOwner] = useState("");

  // Setup the image
  const fetchSeedForToken = async () => {
    fetch(`/spiralapi/seedforid/${id}`)
      .then((r) => r.json())
      .then((data) => {
        const { seed, owner } = data;
        setSeed(seed);
        setOwner(owner);

        if (canvasDetailRef.current) {
          setup_image(canvasDetailRef.current, `detail${id}`, seed);
        }
      });
  };

  useLayoutEffect(() => {
    fetchSeedForToken();
  });

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
        <h1>Spiral #{id}</h1>
        <Container>
          <Row>
            <Col xs={7}>
              <div style={{ textAlign: "left" }}>
                <h5 className="mt-1" style={{ color: "#ffd454" }}>
                  TokenID
                </h5>
                <div>#{id}</div>

                <h5 className="mt-3" style={{ color: "#ffd454" }}>
                  Owner
                </h5>
                <div>{owner}</div>

                <h5 className="mt-3" style={{ color: "#ffd454" }}>
                  Seed
                </h5>
                <div>{seed}</div>
              </div>
            </Col>
            <Col xs={5}>
              <div>Spiral #{id}</div>
              <div style={{ border: "solid 1px", borderRadius: "10px", padding: "10px" }}>
                <canvas ref={canvasDetailRef} width="300px" height="300px"></canvas>
              </div>
            </Col>
          </Row>
        </Container>
      </div>
    </>
  );
}
