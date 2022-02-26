import { ethers, BigNumber } from "ethers";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Alert, Button, Col, Container, FormControl, InputGroup, Row, Tab, Table, Tabs } from "react-bootstrap";
import { Link, useParams } from "react-router-dom";
import { CrystalInfo, DappFunctions, DappState } from "../AppState";
import { setup_maze } from "../mazeRenderer";
import { Navigation } from "./Navigation";
import { formatkmb, retryTillSucceed } from "./utils";

type MazeProps = DappState & DappFunctions & {};

export function Maze(props: MazeProps) {
  const { id } = useParams();
  const canvasDetailRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasDetailRef.current) {
      setup_maze(canvasDetailRef.current, "0x01");
    }
  }, []);

  return (
    <>
      <Navigation {...props} />

      <div style={{ textAlign: "center", marginTop: "-50px", paddingTop: "100px" }}>
        <h1>Maze #1</h1>
        <Container>
          <Row>
            <Col xs={12}>
              <div
                style={{
                  borderRadius: "10px",
                  padding: "10px",
                }}
              >
                <canvas ref={canvasDetailRef} width="600px" height="600px"></canvas>
              </div>
            </Col>
          </Row>
        </Container>
      </div>
    </>
  );
}
