import { BigNumber } from "ethers";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button, Card, Col, Container, ListGroup, Row } from "react-bootstrap";
import { DappContracts, DappFunctions, DappState, SpiralsState } from "../AppState";
import { setup_crystal } from "../crystalRenderer";
import { Navigation } from "./Navigation";

type CrystalsProps = DappState & DappFunctions & DappContracts & {};

export function Crystals(props: CrystalsProps) {
  const a = new Uint8Array(4);
  window.crypto.getRandomValues(a);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [seed, setSeed] = useState(BigNumber.from(a));

  useLayoutEffect(() => {
    if (canvasRef.current) {
      setup_crystal(canvasRef.current, seed.toHexString());
    }
  });

  return (
    <>
      <Navigation {...props} />

      <div style={{ textAlign: "center", marginTop: "-50px", paddingTop: "100px" }}>
        <h1>Current Crystal</h1>

        <Container className="mt-5 mb-5">
          <Row>
            <Col xs={12}>
              <canvas ref={canvasRef} width="650px" height="650px" style={{ border: "solid 1px white" }}></canvas>
            </Col>
          </Row>
          <Row>
            <Col xs={{ span: 1, offset: 5 }}>
              <div>Seed: {seed.toHexString()}</div>
              <Button onClick={() => setSeed(seed.add(1))}>Next</Button>
            </Col>
          </Row>
        </Container>
      </div>
    </>
  );
}
