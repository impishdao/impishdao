import { BigNumber } from "ethers";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Card, Col, Container, ListGroup, Row } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { DappContracts, DappFunctions, DappState, SpiralsState } from "../AppState";
import { setup_crystal } from "../crystalRenderer";
import { Navigation } from "./Navigation";
import { format4Decimals, formatUSD, range, secondsToDhms, THREE_DAYS, trimAddress } from "./utils";

type CrystalsProps = DappState & DappFunctions & DappContracts & {
};

export function Crystals(props: CrystalsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    if (canvasRef.current) {

      setup_crystal(canvasRef.current, "e");
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
              <canvas ref={canvasRef} width="600px" height="600px"></canvas>
            </Col>
          </Row>
        </Container>

      </div>
    </>
  );
}
