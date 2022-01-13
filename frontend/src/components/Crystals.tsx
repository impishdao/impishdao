import { BigNumber } from "ethers";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Col, Container, Row } from "react-bootstrap";
import { DappContracts, DappFunctions, DappState } from "../AppState";
import { setup_crystal } from "../crystalRenderer";
import { Navigation } from "./Navigation";
import { secondsToDhms } from "./utils";

type CrystalsProps = DappState & DappFunctions & DappContracts & {};

export function Crystals(props: CrystalsProps) {
  const a = new Uint8Array(4);
  window.crypto.getRandomValues(a);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [seed, setSeed] = useState(BigNumber.from(a));

  const [timeRemaining, setTimeRemaining] = useState(1642453200 - (Date.now()/1000));

  // Countdown timer.
  useEffect(() => {
    const timerID = setInterval(() => {
      setTimeRemaining(timeRemaining - 60);
    }, 1000 * 60);

    return function cleanup() {
      clearInterval(timerID);
    };
  }, [timeRemaining]);


  useLayoutEffect(() => {
    if (canvasRef.current) {
      setup_crystal(canvasRef.current, seed.toHexString());
    }
  });

  return (
    <>
      <Navigation {...props} />

      <div style={{ textAlign: "center", marginTop: "-50px", paddingTop: "100px" }}>
        <h1>Chapter 3: Impish Crystals</h1>

        <Container className="mt-2 mb-5">
        <Row className="mb-2">
          <div>
            Crystals will be available in <span style={{ color: "#ffd454" }}>{secondsToDhms(timeRemaining)}</span>
          </div>
        </Row>

          <Row>
            <Col xs={12}>
              <canvas ref={canvasRef} width="650px" height="650px"></canvas>
            </Col>
          </Row>          
        </Container>
      </div>
    </>
  );
}
