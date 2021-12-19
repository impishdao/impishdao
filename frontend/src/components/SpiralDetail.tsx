import { useLayoutEffect, useRef, useState } from "react";
import { Col, Container, Row } from "react-bootstrap";
import { useParams } from "react-router-dom";
import { setup_image } from "../spiralRenderer";

export function SpiralDetail() {
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
    <div style={{ textAlign: "center", marginTop: "-50px", paddingTop: "100px" }}>
      <h1>Spiral #{id}</h1>
      <Container>
        <Row>
          <Col xs={7}>
            <div style={{ textAlign: "left" }}>
              <h5>TokenID</h5>
              <div>#{id}</div>

              <h5>Owner</h5>
              <div>{owner}</div>

              <h5>Seed</h5>
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
  );
}
