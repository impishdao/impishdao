import { ethers, BigNumber } from "ethers";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button, Col, Container, FormControl, InputGroup, Row, Tab, Table, Tabs } from "react-bootstrap";
import { Link, useParams } from "react-router-dom";
import { CrystalInfo, DappContracts, DappFunctions, DappState } from "../AppState";
import { setup_crystal } from "../crystalRenderer";
import { Navigation } from "./Navigation";
import { formatkmb, retryTillSucceed } from "./utils";

type CrystalDetailProps = DappState & DappFunctions & DappContracts & {};

export function CrystalDetail(props: CrystalDetailProps) {
  const { id } = useParams();
  const canvasDetailRef = useRef<HTMLCanvasElement>(null);

  const [crystalInfo, setCrystalInfo] = useState<CrystalInfo | undefined>();
  const [approvalNeeded, setApprovalNeeded] = useState(true);

  const [growBy, setGrowBy] = useState("1");
  const [addSym, setAddSym] = useState("1");
  const [reduceSym, setReduceSym] = useState("1");

  const [previewSize, setPreviewSize] = useState<number | undefined>();
  const [previewSym, setPreviewSym] = useState<number | undefined>();

  useEffect(() => {
    if (canvasDetailRef.current && crystalInfo) {
      let size = previewSize || crystalInfo.size;
      let sym = previewSym || crystalInfo.sym;

      setup_crystal(canvasDetailRef.current, crystalInfo.seed.toHexString(), sym, crystalInfo.generation, size / 100);
    }
  }, [crystalInfo, previewSize, previewSym]);

  // Check for approval for Spending by Crystals
  useEffect(() => {
    retryTillSucceed(async () => {
      if (props.selectedAddress && props.crystal && props.spiralbits) {
        const currentAllowance = await props.spiralbits?.allowance(props.selectedAddress, props.crystal?.address);

        setApprovalNeeded(currentAllowance.eq(0));
      }
    });
  }, [props.crystal, props.selectedAddress, props.spiralbits]);

  useLayoutEffect(() => {
    fetch(`/crystalapi/crystal/metadata/${id}`)
      .then((d) => d.json())
      .then((j) => {
        const attributes = j.attributes;
        setCrystalInfo({
          ...attributes,
          seed: BigNumber.from(attributes.seed),
          spiralBitsStored: BigNumber.from(attributes.spiralBitsStored),
        });
      });

    setPreviewSym(undefined);
    setPreviewSize(undefined);
  }, [id]);

  const validateGrowBy = (s: string) => {
    if (isNaN(parseInt(s))) {
      return;
    }

    const n = parseInt(s);

    if (n < 0) {
      return;
    }

    // Max size
    if (crystalInfo && n + crystalInfo.size > 100) {
      return;
    }

    if (n && crystalInfo) {
      setPreviewSize(n + crystalInfo.size);
    } else {
      setPreviewSize(undefined);
    }
    setGrowBy(n.toString());
  };

  const validateAddSym = (s: string) => {
    if (isNaN(parseInt(s))) {
      return;
    }

    const n = parseInt(s);

    if (n < 0) {
      return;
    }

    // Max size
    if (crystalInfo && n + crystalInfo.sym > 20) {
      return;
    }

    if (n && crystalInfo) {
      // Remember that adding a sym also reduces the length
      const newSize = crystalInfo.size * crystalInfo.sym / (crystalInfo.sym + n);
      if (newSize < 30) {
        return;
      }

      setPreviewSize(newSize);
      setPreviewSym(n + crystalInfo.sym);
    } else {
      setPreviewSym(undefined);
    }
    setAddSym(n.toString());
  };

  const validateReduceSym = (s: string) => {
    if (isNaN(parseInt(s))) {
      return;
    }

    const n = parseInt(s);

    if (n < 0) {
      return;
    }

    // Max size
    if (crystalInfo && crystalInfo.sym - n < 3) {
      return;
    }

    if (n && crystalInfo) {
      setPreviewSym(crystalInfo.sym - n);
    } else {
      setPreviewSym(undefined);
    }
    setReduceSym(n.toString());
  };

  const spiralBitsNeededToGrow = (): BigNumber => {
    if (crystalInfo) {
      return ethers.utils.parseEther("1000").mul(crystalInfo.sym * parseInt(growBy));
    }

    return BigNumber.from(0);
  };

  const spiralBitsNeededToAddSym = (): BigNumber => {
    if (crystalInfo) {
      return ethers.utils.parseEther("20000").mul(addSym);
    }

    return BigNumber.from(0);
  };

  const spiralBitsNeededToReduceSym = (): BigNumber => {
    if (crystalInfo) {
      return ethers.utils.parseEther("20000").mul(reduceSym);
    }

    return BigNumber.from(0);
  };

  const growCrystal = async () => {
    if (props.selectedAddress && props.crystal && props.spiralbits && crystalInfo) {
      // Check for approval needed first
      if (approvalNeeded) {
        await props.waitForTxConfirmation(
          props.spiralbits.approve(props.crystal.address, ethers.utils.parseEther("2000000000")),
          "Approving SPIRALBITS"
        );
      }

      await props.waitForTxConfirmation(props.crystal.grow(id, parseInt(growBy)), "Growing Crystal");

      const newSize = crystalInfo.size + parseInt(growBy);
      const newSpiralBitsStored = crystalInfo.spiralBitsStored.add(spiralBitsNeededToGrow().div(2));
      setCrystalInfo({...crystalInfo, size: newSize, spiralBitsStored: newSpiralBitsStored});
    }
  };

  const doAddSym = async () => {
    if (props.selectedAddress && props.crystal && props.spiralbits && crystalInfo) {
      // Check for approval needed first
      if (approvalNeeded) {
        await props.waitForTxConfirmation(
          props.spiralbits.approve(props.crystal.address, ethers.utils.parseEther("2000000000")),
          "Approving SPIRALBITS"
        );
      }

      await props.waitForTxConfirmation(props.crystal.addSym(id, parseInt(addSym)), "Adding Symmetry to Crystal");
      
      const newSym = crystalInfo.sym + parseInt(addSym);
      const newSize = crystalInfo.size * crystalInfo.sym / newSym;
      setCrystalInfo({...crystalInfo, size: Math.floor(newSize), sym: newSym});
    }
  };

  const doReduceSym = async () => {
    if (props.selectedAddress && props.crystal && props.spiralbits && crystalInfo) {
      // Check for approval needed first
      if (approvalNeeded) {
        await props.waitForTxConfirmation(
          props.spiralbits.approve(props.crystal.address, ethers.utils.parseEther("2000000000")),
          "Approving SPIRALBITS"
        );
      }

      await props.waitForTxConfirmation(props.crystal.decSym(id, parseInt(reduceSym)), "Reduce Symmetry of Crystal");
      
      const newSize = crystalInfo.sym - parseInt(reduceSym);
      setCrystalInfo({...crystalInfo, sym: newSize});
    }
  };

  return (
    <>
      <Navigation {...props} />
      <div style={{ textAlign: "center", marginTop: "-50px", paddingTop: "100px" }}>
        <h1>Crystal #{id}</h1>
        <Container>
          <Row>
            <Col xs={5} style={{ textAlign: "left" }}>
              <h5 className="mt-3" style={{ color: "#ffd454" }}>
                Properties
              </h5>
              <Table style={{ color: "white" }}>
                <tbody>
                  <tr>
                    <td>Size</td>
                    <td>{crystalInfo?.size} %</td>
                  </tr>
                  <tr>
                    <td>Symmetries</td>
                    <td>{crystalInfo?.sym}</td>
                  </tr>
                  <tr>
                    <td>Generation</td>
                    <td>{crystalInfo?.generation}</td>
                  </tr>
                  <tr>
                    <td>SPIRALBITS stored</td>
                    <td>{formatkmb(crystalInfo?.spiralBitsStored)}</td>
                  </tr>
                </tbody>
              </Table>

              <h5 className="mt-3" style={{ color: "#ffd454" }}>
                Owner
              </h5>
              <div>
                {crystalInfo && (
                  <Link to={`/crystals/wallet/${crystalInfo.owner}`} style={{ color: "white", textDecoration: "none" }}>
                    {crystalInfo?.owner}
                  </Link>
                )}
              </div>

              {props.selectedAddress && (
                <>
                  <h5 className="mt-5" style={{ color: "#ffd454" }}>
                    Manage Crystal
                  </h5>
                  <Tabs className="mt-3">
                    <Tab eventKey="Grow" title="Grow" tabClassName="colorwhite">
                      <div style={{ fontSize: "0.9rem", marginTop: "10px" }}>
                        Grow your crystal by feeding it SPIRALBITS. Half of the $SPIRALBITS are stored inside the
                        Crystal (and the other half are burned)
                      </div>

                      <div style={{ display: "flex", gap: "30px", marginTop: "10px" }}>
                        <InputGroup>
                          <InputGroup.Text>Grow Size By</InputGroup.Text>
                          <FormControl
                            type="number"
                            style={{ textAlign: "right" }}
                            value={growBy}
                            onChange={(e) => validateGrowBy(e.currentTarget.value)}
                          />
                          <Button>Max</Button>
                        </InputGroup>
                        <Button variant="warning" onClick={growCrystal}>
                          Grow
                        </Button>
                      </div>

                      <div style={{ marginTop: "10px" }}>Cost: {formatkmb(spiralBitsNeededToGrow())} SPIRALBITS</div>
                    </Tab>
                    <Tab eventKey="Add" title="Add Symmetry" tabClassName="colorwhite">
                      <div style={{ fontSize: "0.9rem", marginTop: "10px" }}>
                        Adding a symmetry increases the complexity of the Crystal, but will need more SPIRALBITS to
                        grow. Your Crystal will also shrink proportionally
                      </div>

                      <div style={{ display: "flex", gap: "30px", marginTop: "10px" }}>
                        <InputGroup>
                          <InputGroup.Text>Add Symmetries</InputGroup.Text>
                          <FormControl
                            type="number"
                            style={{ textAlign: "right" }}
                            value={addSym}
                            onChange={(e) => validateAddSym(e.currentTarget.value)}
                          />
                          <Button>Max</Button>
                        </InputGroup>
                        <Button variant="warning" onClick={doAddSym}>
                          Add
                        </Button>
                      </div>

                      <div style={{ marginTop: "10px" }}>Cost: {formatkmb(spiralBitsNeededToAddSym())} SPIRALBITS</div>
                    </Tab>
                    <Tab eventKey="Reduce" title="Reduce Symmetry" tabClassName="colorwhite">
                      <div style={{ fontSize: "0.9rem", marginTop: "10px" }}>
                        Reducing symmetry decreases the complexity of the Crystal and needs fewer SPIRALBITS to grow.
                      </div>

                      <div style={{ display: "flex", gap: "30px", marginTop: "10px" }}>
                        <InputGroup>
                          <InputGroup.Text>Reduce Symmetries</InputGroup.Text>
                          <FormControl
                            type="number"
                            style={{ textAlign: "right" }}
                            value={reduceSym}
                            onChange={(e) => validateReduceSym(e.currentTarget.value)}
                          />
                          <Button>Max</Button>
                        </InputGroup>
                        <Button variant="warning" onClick={doReduceSym}>
                          Reduce
                        </Button>
                      </div>

                      <div style={{ marginTop: "10px" }}>
                        Cost: {formatkmb(spiralBitsNeededToReduceSym())} SPIRALBITS
                      </div>
                    </Tab>
                    <Tab eventKey="Shatter" title="Shatter" tabClassName="colorwhite">
                      <div>Shatter</div>
                    </Tab>
                  </Tabs>
                </>
              )}
            </Col>
            <Col xs={7}>
              {(previewSize || previewSym) && <div>PREVIEW</div>}
              {!(previewSize || previewSym) && <div>Crystal #{id}</div>}
              <div
                style={{
                  border: `solid ${previewSym || previewSize ? "3px #ffd454" : "1px white"}`,
                  borderRadius: "10px",
                  padding: "10px",
                }}
              >
                <canvas ref={canvasDetailRef} width="500px" height="500px" style={{ cursor: "pointer" }}></canvas>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  gap: "10px",
                  marginTop: "10px",
                  justifyContent: "center",
                }}
              >
                {/* {(props.selectedAddress && crystalInfo?.owner.toLowerCase() === props.selectedAddress?.toLowerCase()) && (
                  <Button variant="dark" onClick={() => setTransferAddressModalShowing(true)}>
                    Transfer
                  </Button>
                )} */}
              </div>
            </Col>

            <div className="mb-4"></div>
          </Row>
        </Container>
      </div>
    </>
  );
}
