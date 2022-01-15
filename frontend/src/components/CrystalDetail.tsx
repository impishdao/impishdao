import { ethers, BigNumber } from "ethers";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button, Col, Container, FormControl, InputGroup, Row, Tab, Table, Tabs } from "react-bootstrap";
import { useParams } from "react-router-dom";
import { DappContracts, DappFunctions, DappState } from "../AppState";
import { setup_crystal } from "../crystalRenderer";
import { Navigation } from "./Navigation";
import { formatkmb, retryTillSucceed } from "./utils";

type CrystalDetailProps = DappState & DappFunctions & DappContracts & {};

type CrystalInfo = {
  size: number;
  generation: number;
  sym: number;
  seed: BigNumber;
  spiralBitsStored: BigNumber;
  owner: string;
};

export function CrystalDetail(props: CrystalDetailProps) {
  const { id } = useParams();
  const canvasDetailRef = useRef<HTMLCanvasElement>(null);

  const [refreshCounter, setRefreshCounter] = useState(0);
  const [crystalInfo, setCrystalInfo] = useState<CrystalInfo | undefined>();
  const [approvalNeeded, setApprovalNeeded] = useState(true);

  const [growBy, setGrowBy] = useState("1");
  const [addSym, setAddSym] = useState("1");
  const [reduceSym, setReduceSym] = useState("1");

  useEffect(() => {
    if (canvasDetailRef.current && crystalInfo) {
      setup_crystal(
        canvasDetailRef.current,
        crystalInfo.seed.toString(),
        crystalInfo.sym,
        crystalInfo.generation,
        crystalInfo.size / 100
      );
    }
  }, [crystalInfo]);

  // Check for approval for Spending by Crystals
  useEffect(() => {
    retryTillSucceed(async () => {
      if (props.selectedAddress && props.crystal && props.spiralbits) {
        const currentAllowance = await props.spiralbits?.allowance(props.selectedAddress, props.crystal?.address);

        setApprovalNeeded(currentAllowance.eq(0));
      }
    });
  }, [props.crystal, props.selectedAddress, props.spiralbits, refreshCounter]);

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
  }, [id, refreshCounter]);

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
    if (props.selectedAddress && props.crystal && props.spiralbits) {
      // Check for approval needed first
      if (approvalNeeded) {
        await props.waitForTxConfirmation(
          props.spiralbits.approve(props.crystal.address, ethers.utils.parseEther("2000000000")),
          "Approving SPIRALBITS"
        );
      }

      await props.waitForTxConfirmation(props.crystal.grow(id, parseInt(growBy)), "Growing Crystal");
      setRefreshCounter(refreshCounter + 1);
    }
  };

  const doAddSym = async () => {
    if (props.selectedAddress && props.crystal && props.spiralbits) {
      // Check for approval needed first
      if (approvalNeeded) {
        await props.waitForTxConfirmation(
          props.spiralbits.approve(props.crystal.address, ethers.utils.parseEther("2000000000")),
          "Approving SPIRALBITS"
        );
      }

      await props.waitForTxConfirmation(props.crystal.addSym(id, parseInt(addSym)), "Adding Symmetry to Crystal");
      setRefreshCounter(refreshCounter + 1);
    }
  };

  const doReduceSym = async () => {
    if (props.selectedAddress && props.crystal && props.spiralbits) {
      // Check for approval needed first
      if (approvalNeeded) {
        await props.waitForTxConfirmation(
          props.spiralbits.approve(props.crystal.address, ethers.utils.parseEther("2000000000")),
          "Approving SPIRALBITS"
        );
      }

      await props.waitForTxConfirmation(props.crystal.decSym(id, parseInt(reduceSym)), "Reduce Symmetry of Crystal");
      setRefreshCounter(refreshCounter + 1);
    }
  };

  return (
    <>
      <Navigation {...props} />
      <div style={{ textAlign: "center", marginTop: "-50px", paddingTop: "100px" }}>
        <h1>Crystal #{id}</h1>
        <Container>
          <Row>
            <Col xs={5}>
              {props.selectedAddress && (
                <>
                  <Tabs>
                    <Tab eventKey="Grow" title="Grow">
                      <div>
                        You can grow your crystal by feeding it SPIRALBITS. Half of the $SPIRALBITS are stored inside
                        the Crystal (and the other half are burned)
                      </div>

                      <div style={{ display: "flex", gap: "10px" }}>
                        <InputGroup>
                          <InputGroup.Text>Grow Size By</InputGroup.Text>
                          <FormControl
                            type="number"
                            value={growBy}
                            onChange={(e) => validateGrowBy(e.currentTarget.value)}
                          />
                        </InputGroup>
                        <Button variant="warning" onClick={growCrystal}>
                          Grow
                        </Button>
                      </div>

                      <div>
                        Growing by {growBy} will cost SPIRALBITS {formatkmb(spiralBitsNeededToGrow())}{" "}
                      </div>
                    </Tab>
                    <Tab eventKey="Add" title="Add Symmetry">
                      <div>
                        Adding a symmetry increases the complexity of the Crystal, but will need more SPIRALBITS to
                        grow. Your Crystal will also shrink proportioanlly
                      </div>

                      <div style={{ display: "flex", gap: "10px" }}>
                        <InputGroup>
                          <InputGroup.Text>Add Symmetries</InputGroup.Text>
                          <FormControl
                            type="number"
                            value={addSym}
                            onChange={(e) => validateAddSym(e.currentTarget.value)}
                          />
                        </InputGroup>
                        <Button variant="warning" onClick={doAddSym}>
                          Add
                        </Button>
                      </div>

                      <div>
                        Adding {addSym} Symmetries will cost SPIRALBITS {formatkmb(spiralBitsNeededToAddSym())}{" "}
                      </div>
                    </Tab>
                    <Tab eventKey="Reduce" title="Reduce Symmetry">
                      <div>
                        Reducing symmetry decreases the complexity of the Crystal and needs fewer SPIRALBITS to grow.
                      </div>

                      <div style={{ display: "flex", gap: "10px" }}>
                        <InputGroup>
                          <InputGroup.Text>Reduce Symmetries</InputGroup.Text>
                          <FormControl
                            type="number"
                            value={reduceSym}
                            onChange={(e) => validateReduceSym(e.currentTarget.value)}
                          />
                        </InputGroup>
                        <Button variant="warning" onClick={doReduceSym}>
                          Reduce
                        </Button>
                      </div>

                      <div>
                        Reducing {reduceSym} Symmetries will cost SPIRALBITS {formatkmb(spiralBitsNeededToReduceSym())}{" "}
                      </div>
                    </Tab>
                    <Tab eventKey="Shatter" title="Shatter">
                      <div>Shatter</div>
                    </Tab>
                  </Tabs>
                </>
              )}
            </Col>
            <Col xs={7}>
              <div>Crystal #{id}</div>
              <div style={{ border: "solid 1px", borderRadius: "10px", padding: "10px" }}>
                <canvas ref={canvasDetailRef} width="650px" height="650px" style={{ cursor: "pointer" }}></canvas>
              </div>
              <Table style={{ color: "white" }}>
                <tbody>
                  <tr>
                    <td>Size</td>
                    <td>{crystalInfo?.size}</td>
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
                  <tr>
                    <td>Seed</td>
                    <td>{crystalInfo?.seed.toHexString()}</td>
                  </tr>
                </tbody>
              </Table>
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
