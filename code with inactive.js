import React, { Component } from 'react';
import { Container, Row, Col, Card, Form, Tabs, Tab, Alert ,Button,Modal} from "react-bootstrap";
import { DatePicker } from 'antd';
import 'antd/dist/antd.css';
import axios from 'axios';
import Loader from "./LoaderModal";
import ErrorAlert from './ErrorAlert';
import C from '../lib/Config';
import moment from 'moment';

const dateFormat = 'DD/MM/yyyy';

class AnalyticsReport extends Component {
    constructor(props) {
        super(props);
        this.state = {
            patientId: props.patientId,
            patientDetails: {},
            activeTreatmentPlans: [],
            inactiveTreatmentPlans: [],
            inactiveSchedules: {},
            followUpAppointments: null,
            previousChemoDetails: [],
            generatedSchedules: {},
            loaderModal: false,
            key: 'summary',
            error: null,
            observe: '',
            prescription: '',
            allTreatmentPlans: [], // Ensure this is initialized as an empty array
            selectedTreatmentDetails: null,
            showTreatmentModal: false,
            allTreatmentPlans: []

        };

        this.setKey = this.setKey.bind(this);
        this.getPatientDetails = this.getPatientDetails.bind(this);
        this.fetchFollowUpAppointments = this.fetchFollowUpAppointments.bind(this);
        this.fetchChemoDetails = this.fetchChemoDetails.bind(this);
    }

    componentDidMount() {
        const { patientId } = this.props;
        if (patientId) {
            this.setState({ patientId, loaderModal: true });
            this.getPatientDetails(patientId);
            this.getActiveTreatmentPlans(patientId);
            this.fetchFollowUpAppointments(patientId);
            this.fetchChemoDetails(patientId);
            this.fetchAdverseEffects(patientId);  // Fetch adverse effects
            this.getInactiveTreatmentPlans(patientId);
        }
    }

    componentDidUpdate(prevProps) {
        if (prevProps.patientId !== this.props.patientId) {
            this.setState({ patientId: this.props.patientId, loaderModal: true });
            this.getPatientDetails(this.props.patientId);
            this.getActiveTreatmentPlans(this.props.patientId);
            this.fetchFollowUpAppointments(this.props.patientId);
            this.fetchChemoDetails(this.props.patientId);
            this.fetchAdverseEffects(this.props.patientId);  // Fetch adverse effects
            this.getInactiveTreatmentPlans(this.props.patientId);
        }
    }

    getPatientDetails(patientId) {
        return fetch(C.getUrl() + `/analytics/getreport?patientid=${patientId}`)
            .then(response => response.json())
            .then(data => {
                this.setState({
                    patientDetails: data,
                    patientAge: this.getPatientAge(data.dob),
                    loaderModal: false,
                });
            })
            .catch(error => {
                this.setState({ error, loaderModal: false });
            });
    }

    getPatientAge(dob) {
        let birthDate = new Date(dob);
        let otherDate = new Date();
        let years = (otherDate.getFullYear() - birthDate.getFullYear());
        if (otherDate.getMonth() < birthDate.getMonth() ||
            (otherDate.getMonth() === birthDate.getMonth() && otherDate.getDate() < birthDate.getDate())) {
            years--;
        }
        return years;
    }

    getActiveTreatmentPlans(patientId) {
        return fetch(C.getUrl() + `/userCase/getTreatmentPlanDetails?patientId=${patientId}`)
            .then(res => res.json())
            .then(res => {
                let resObj = JSON.parse(res.message);
                let activeTreatmentPlans = resObj.patientTreatmentPlanDTOList || [];
                
                let generatedSchedules = {};
                activeTreatmentPlans.forEach(plan => {
                    if (plan.scheduleMstDTO.scheduleDays && plan.chemoStartDt && plan.cyclesPlanned) {
                        generatedSchedules[plan.patientTreatmentPlanId] = this.generateSchedule(
                            plan.scheduleMstDTO.scheduleDays, 
                            plan.chemoStartDt, 
                            plan.cyclesPlanned
                        );
                    }
                });
                
                this.setState({ activeTreatmentPlans, generatedSchedules, loaderModal: false });
            })
            .catch(err => {
                console.log("Error : " + err);
                this.setState({ error: true, loaderModal: false });
            });
    }
    
    getInactiveTreatmentPlans(patientId) {
        return fetch(C.getUrl() + `/userCase/getTerminatedTreatments/${patientId}`)
            .then(res => res.json())
            .then(res => {
                let inactiveTreatmentPlans = JSON.parse(res.message) || [];
                let inactiveSchedules = {};

                inactiveTreatmentPlans.forEach(plan => {
                    if (plan.scheduleMstDTO.scheduleDays && plan.chemoStartDt && plan.cyclesPlanned) {
                        inactiveSchedules[plan.patientTreatmentPlanId] = this.generateSchedule(
                            plan.scheduleMstDTO.scheduleDays, 
                            plan.chemoStartDt, 
                            plan.cyclesPlanned
                        );
                    }
                });

                this.setState({ inactiveTreatmentPlans, inactiveSchedules });
            })
            .catch(err => {
                console.log("Error : " + err);
                this.setState({ error: true });
            });
    }
    
    fetchFollowUpAppointments(patientId) {
        fetch(`${C.getUrl()}/followupAppt/findAll/${patientId}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('');
                }
                return response.json();
            })
            .then(data => {
                if (data.message) {
                    const message = JSON.parse(data.message);
                    const followUpAppointments = message.followUpAppointments.map(appointment => {
                        let adverseEffects = '';
                        if (appointment.followupAdverseEffectDTOList && appointment.followupAdverseEffectDTOList.length !== 0) {
                            adverseEffects = appointment.followupAdverseEffectDTOList.map(effect => effect.reportParameterMstDTO.reportParamName).join(', ');
                        }
                        return {
                            ...appointment,
                            adverseEffects
                        };
                    });
                    this.setState({
                        followUpAppointments,
                        doctorObservation: message.doctorObservation,
                        doctorPrescription: message.doctorPrescription,
                        error: null
                    });
                } else {
                    this.setState({ followUpAppointments: [], doctorObservation: '', doctorPrescription: '' });
                }
            })
            .catch(error => {
                console.error('Error fetching follow-up appointments:', error.message);
                this.setState({ followUpAppointments: [], doctorObservation: '', doctorPrescription: '' });
            });
    }
    
    fetchChemoDetails(patientId) {
        fetch(`${C.getUrl()}/userCase/getAllChemoSitting/${patientId}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('No record found.');
                }
                return response.json();
            })
            .then(data => {
                if (data.statusCode === 200 && data.message !== 'No record found.') {
                    this.setState({ previousChemoDetails: JSON.parse(data.message) });
                } else {
                    this.setState({ previousChemoDetails: [] });
                }
            })
            .catch(error => {
                console.error('Error fetching chemo details:', error.message);
                this.setState({ previousChemoDetails: [] });
            });
    }
    
    renderChemoDetails() {
        const { previousChemoDetails } = this.state;
        const dateFormat = 'DD/MM/yyyy';

        return previousChemoDetails.map((chemo, index) => (
            <div key={index} className="mb-3">
                Sitting - {moment(chemo.chemoDt).format(dateFormat)}
                <Row>
                    <Col sm="4">
                        <strong>Chemo Sitting Date:</strong> {moment(chemo.chemoDt).format(dateFormat)}
                    </Col>
                    <Col sm="4">
                        <strong>Delay in this Cycle:</strong> {chemo.delay === 'Y' ? 'Yes' : 'No'}
                    </Col>
                    <Col sm="4">
                        <strong>Treatment Given:</strong> {chemo.treatmentGiven || 'No details available'}
                    </Col>
                </Row>
            </div>
        ));
    }
    
    setKey(key) {
        this.setState({ key });
    }

    formatDateMMDDYY(date) {
        if (date) {
            return (new Date(date)).toISOString().split('T')[0];
        }
        return "";
    }

    // Chemo schedule
    addDays(forDate, days) {
        var newDate = new Date(forDate.getTime() + (days * 86400000));
        return newDate;
    }

    generateSchedule(scheduleDays, chemoStartDt, cyclesPlanned) {
        let generatedScheduledArr = [];
        let nextChemoDate = new Date(chemoStartDt);
        
        for (let x = 1; x <= cyclesPlanned; x++) {
            let data = {
                scheduleNum: x,
                scheduledDate: nextChemoDate
            };
            generatedScheduledArr.push(data);
            nextChemoDate = this.addDays(nextChemoDate, scheduleDays);
        }
        
        return generatedScheduledArr;
    }

    renderGeneratedSchedule(treatmentPlanId, schedules) {
        if (!schedules[treatmentPlanId] || schedules[treatmentPlanId].length === 0) {
            return <div>No scheduled dates available.</div>;
        }

        return (
            <table className="table table-striped table-hover text-center">
                <thead className="thead-light">
                    <tr>
                        <th>#</th>
                        <th>Schedule Date</th>
                    </tr>
                </thead>
                <tbody>
                    {schedules[treatmentPlanId].map((schedule, idx) => (
                        <tr key={idx}>
                            <td>{schedule.scheduleNum}</td>
                            <td>{moment(schedule.scheduledDate).format('DD/MM/yyyy')}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    }

    mapIntent(intent) {
        if (intent === 'C') {
            return 'Curative';
        } else if (intent === 'P') {
            return 'Palliative';
        } else {
            return intent; // fallback in case of unexpected value
        }
    }

    mapBrainMets(brainMets) {
        if (brainMets === 'Y') {
            return 'Yes';
        } else if (brainMets === 'N') {
            return 'No';
        } else {
            return brainMets; // fallback in case of unexpected value
        }
    }

    mapBoneMetasis(boneMetasis) {
        if (boneMetasis === 'Y') {
            return 'Yes';
        } else if (boneMetasis === 'N') {
            return 'No';
        } else {
            return boneMetasis; // fallback in case of unexpected value
        }
    }

    fetchAdverseEffects(patientId) {
        fetch(C.getUrl() + `/followupAppt/findAll/${patientId}`)
            .then(response => response.json())
            .then(data => {
                if (data.message) {
                    const message = JSON.parse(data.message);
                    const adverseEffects = message.followupAdverseEffectDTOList.map(effect => {
                        return {
                            name: effect.reportParameterMstDTO.reportParamName,
                            desc: effect.reportParameterMstDTO.reportParamDesc,
                        };
                    });
                    this.setState({ adverseEffects });
                } else {
                    this.setState({ adverseEffects: [] });
                }
            })
            .catch(error => {
                console.error('Error fetching adverse effects:', error);
                this.setState({ adverseEffects: [] });
            });
    }

    renderAdverseEffects() {
        const { adverseEffects } = this.state;

        if (!adverseEffects || adverseEffects.length === 0) {
            return <div></div>;
        }

        return adverseEffects.map((effect, index) => (
            <div key={index} className="mb-2">
               {effect.name}
            </div>
        ));
    }

    handleViewTreatment(treatmentPlanId) {
        // Fetch detailed treatment plan information and update state
        fetch(C.getUrl() + `/userCase/getTreatmentPlanDetail/${treatmentPlanId}`)
            .then(res => res.json())
            .then(res => {
                let treatmentDetails = JSON.parse(res.message);
                this.setState({ selectedTreatmentDetails: treatmentDetails, showTreatmentModal: true });
            })
            .catch(err => {
                console.log("Error fetching treatment plan details: " + err);
            });
    }

    closeTreatmentModal() {
        this.setState({ showTreatmentModal: false });
    }

    renderTreatmentDetails() {
        const { selectedTreatmentDetails } = this.state;
        if (!selectedTreatmentDetails) return null;

        return (
            <div className="product-details pl-3 ml-3">
                <p><label>Treatment Plan Date:</label> {this.formatDateMMDDYY(selectedTreatmentDetails.creationDate)}</p>
                <p><label>Intent:</label> {selectedTreatmentDetails.intent === 'C' ? 'Curative' : selectedTreatmentDetails.intent === 'P' ? 'Palliative' : selectedTreatmentDetails.intent || ''}</p>
                <p><label>Rx Modification Date:</label> {this.formatDateMMDDYY(selectedTreatmentDetails.modifiedDate)}</p>
                <p><label>Regimen Planned (Protocol Title):</label> {selectedTreatmentDetails.protocolMstDTO.protocolName}</p>
                <p><label>Chemotherapy Phase/Regimen Due:</label> {selectedTreatmentDetails.chemoPhaseRegimen}</p>
                <p><label>Schedule for Doctor's Visit:</label> {selectedTreatmentDetails.scheduleMstDTO.scheduleName}</p>
                <p><label>Cycles Planned:</label> {selectedTreatmentDetails.cyclesPlanned}</p>
                <p><label>1st Chemo Cycle:</label> {this.formatDateMMDDYY(selectedTreatmentDetails.chemoStartDt)}</p>
                <p><label>Plan of Treatment:</label> {selectedTreatmentDetails.treatmentPlan}</p>
                <p><label>Consent waive Off comment:</label> {selectedTreatmentDetails.waiveOffConsent}</p>
                <p><label>Dosage Frequency:</label> {selectedTreatmentDetails.scheduleMstDTO.scheduleName}</p>
            </div>
        );
    }
    render() {
        const { key, patientDetails, activeTreatmentPlans, inactiveTreatmentPlans,allTreatmentPlans,showTreatmentModal, inactiveSchedules, followUpAppointments, error,
             loaderModal, doctorObservation, doctorPrescription } = this.state;

        if (loaderModal) {
            return <Loader />;
        }
        return (
            <div className="d-flex" id="wrapper">
                <div id="content-wrapper" className="d-flex flex-column">
                    <div id="content">
                        <Container fluid>
                            <div className="app-content">
                                <section className="section" id="accordion">
                                    <div className="form formBackground">
                                        <Card className="custom-card mb-4">
                                            <Card.Header className="fixed-header"><b>Case Summary</b></Card.Header>
                                            <Card.Body className="">
                                                <Container fluid className="p-0 mt-4">
                                                    <Row>
                                                        <Col lg="4" className="form-inline">
                                                            <Form.Group className="mb-0">
                                                                <Form.Label className="mr-3">Case No.</Form.Label>
                                                                <Form.Control
                                                                    type="text"
                                                                    className="readOnlyView inline"
                                                                    value={patientDetails.caseId || ''}
                                                                    name="caseNo"
                                                                    disabled
                                                                />
                                                            </Form.Group>
                                                        </Col>
                                                        <Col lg="3" className="form-inline">
                                                            <Form.Group className="mb-0">
                                                                <Form.Label className="mr-3">Patient Name</Form.Label>
                                                                <Form.Control
                                                                    type="text"
                                                                    className="readOnlyView inline"
                                                                    value={`${patientDetails.firstName || ''} ${patientDetails.lastName || ''}`}
                                                                    name="firstName"
                                                                    disabled
                                                                />
                                                            </Form.Group>
                                                        </Col>
                                                        <Col lg="3" className="form-inline">
                                                            <Form.Group className="mb-0">
                                                                <Form.Label className="mr-3">Age</Form.Label>
                                                                <Form.Control
                                                                    type="text"
                                                                    className="readOnlyView inline"
                                                                    value={`${this.getPatientAge(patientDetails.dob)} Years`}
                                                                    name="age"
                                                                    disabled
                                                                />
                                                            </Form.Group>
                                                        </Col>
                                                        <Col lg="3" className="form-inline">
                                                            <Form.Group className="mb-0">
                                                                <Form.Label className="mr-3">Gender</Form.Label>
                                                                <Form.Control
                                                                    type="text"
                                                                    className="readOnlyView inline"
                                                                    value={patientDetails.genderName || ''}
                                                                    name="gender"
                                                                    disabled
                                                                />
                                                            </Form.Group>
                                                        </Col>
                                                    </Row>
                                                    <div className="dropdown-divider pb-2"></div>
                                                    <Row>
                                                        <Col lg="4">
                                                            <Form.Group>
                                                                <Form.Label>Date Of Birth</Form.Label>
                                                                <Form.Control
                                                                    type="text"
                                                                    className="readOnlyView inline"
                                                                    value={moment(patientDetails.dob).format('DD-MM-YYYY') || ''}
                                                                    name="dob"
                                                                    disabled
                                                                />
                                                            </Form.Group>
                                                        </Col>
                                                        <Col lg="4">
                                                            <Form.Group>
                                                                <Form.Label>Email address</Form.Label>
                                                                <Form.Control
                                                                    type="email"
                                                                    className="readOnlyView inline"
                                                                    value={patientDetails.emailId || ''}
                                                                    disabled
                                                                />
                                                            </Form.Group>
                                                        </Col>
                                                        <Col lg="4">
                                                            <Form.Group>
                                                                <Form.Label>Contact No.</Form.Label>
                                                                <Form.Control
                                                                    type="text"
                                                                    className="readOnlyView inline"
                                                                    value={patientDetails.phoneNumber1 || ''}
                                                                    name="phoneNumber1"
                                                                    disabled
                                                                />
                                                            </Form.Group>
                                                        </Col>
                                                        <Col lg="4">
                                                            <Form.Group>
                                                                <Form.Label>Height</Form.Label>
                                                                <Form.Control
                                                                    type="text"
                                                                    className="readOnlyView inline"
                                                                    value={`${patientDetails.height || ''} cm`}
                                                                    name="height"
                                                                    disabled
                                                                />
                                                            </Form.Group>
                                                        </Col>
                                                        <Col lg="4">
                                                            <Form.Group>
                                                                <Form.Label>Any ongoing treatment</Form.Label>
                                                                <Form.Control
                                                                    type="text"
                                                                    className="readOnlyView inline"
                                                                    value={patientDetails.ongoingTreatment || ''}
                                                                    name="ongoingTreatment"
                                                                    disabled
                                                                />
                                                            </Form.Group>
                                                        </Col>
                                                        <Col lg="4">
                                                            <Form.Group>
                                                                <Form.Label>Other Allergies</Form.Label>
                                                                <Form.Control
                                                                    type="text"
                                                                    className="readOnlyView inline"
                                                                    value={patientDetails.allergies || ''}
                                                                    name="allergies"
                                                                    disabled
                                                                />
                                                            </Form.Group>
                                                        </Col>
                                                        <Col lg="4">
                                                            <Form.Group>
                                                                <Form.Label>Comorbidities</Form.Label>
                                                                <Form.Control
                                                                    type="text"
                                                                    className="readOnlyView inline"
                                                                    value={patientDetails.comorbiditiesName || ''}
                                                                    name="comorbidities"
                                                                    disabled
                                                                />
                                                            </Form.Group>
                                                        </Col>
                                                        <Col lg="4">
                                                            <Form.Group>
                                                                <Form.Label>Other Comorbidities</Form.Label>
                                                                <Form.Control
                                                                    type="text"
                                                                    className="readOnlyView inline"
                                                                    value={patientDetails.otherComorbidities || ''}
                                                                    name="otherComorbidities"
                                                                    disabled
                                                                />
                                                            </Form.Group>
                                                        </Col>
                                                    </Row>
                                                </Container>
                                            </Card.Body>
                                        </Card>
                                        <Card className="custom-card">
                                            <Card.Header className="fixed-header"><b>Initial Assessment</b></Card.Header>
                                            <Card.Body className="">
                                                <Container fluid className="p-0 mt-4">
                                                    <Row>
                                                        <Col lg="4">
                                                            <Form.Group className="mb-0">
                                                                <Form.Label className="mr-3">Initial Assessment Date</Form.Label>
                                                                <DatePicker value={patientDetails.patientIniAssessmentDt ? moment(patientDetails.patientIniAssessmentDt) : null} format={dateFormat} disabled className="form-control full-width25" />
                                                            </Form.Group>
                                                        </Col>
                                                        <Col lg="4">
                                                            <Form.Group className="mb-0">
                                                                <Form.Label className="mr-3">Pathology</Form.Label>
                                                                <Form.Control
                                                                    type="text"
                                                                    className="readOnlyView inline"
                                                                    value={patientDetails.pathologyName || ''}
                                                                    name="pathologyName"
                                                                    disabled
                                                                />
                                                            </Form.Group>
                                                        </Col>
                                                        <Col lg="4">
                                                            <Form.Group className="mb-0">
                                                                <Form.Label className="mr-3">Cancer stage</Form.Label>
                                                                <Form.Control
                                                                    type="text"
                                                                    className="readOnlyView inline"
                                                                    value={patientDetails.stageId || ''}
                                                                    name="stageId"
                                                                    disabled
                                                                />
                                                            </Form.Group>
                                                        </Col>
                                                        <div className="w-100 my-3"></div>
                                                   
                                                        {patientDetails.stageId === '4' && (
                                                            <>
                                                                <Col lg="4">
                                                                    <Form.Group className="mb-0">
                                                                        <Form.Label className="mr-3">Bone Metastasis</Form.Label>
                                                                        <Form.Control
                                                                            type="text"
                                                                            className="readOnlyView inline"
                                                                            value={patientDetails.boneMetasis === 'Y' ? 'Yes' : patientDetails.boneMetasis === 'N' ? 'No' : patientDetails.boneMetasis || ''}
                                                                            name="boneMetasis"
                                                                            disabled
                                                                        />
                                                                    </Form.Group>
                                                                </Col>
                                                                <Col lg="4">
                                                                    <Form.Group className="mb-0">
                                                                        <Form.Label className="mr-3">Brain Mets</Form.Label>
                                                                        <Form.Control
                                                                            type="text"
                                                                            className="readOnlyView inline"
                                                                            value={patientDetails.brainMets === 'Y' ? 'Yes' : patientDetails.brainMets === 'N' ? 'No' : patientDetails.brainMets || ''}
                                                                            name="brainMets"
                                                                            disabled
                                                                        />
                                                                    </Form.Group>
                                                                </Col>
                                                            </>
                                                        )}
                                                        <Col lg="4">
                                                            <Form.Group className="mb-0">
                                                                <Form.Label className="mr-3">Limb Loss</Form.Label>
                                                                <Form.Control
                                                                    type="text"
                                                                    className="readOnlyView inline"
                                                                    value={patientDetails.limbLossName || ''}
                                                                    name="limbLossName"
                                                                    disabled
                                                                />
                                                            </Form.Group>
                                                        </Col>
                                                        <div className="w-100 my-3"></div>
                                                        <Col lg="4">
                                                            <Form.Group className="mb-0">
                                                                <Form.Label className="mr-3">Mutation</Form.Label>
                                                                <Form.Control
                                                                    type="text"
                                                                    className="readOnlyView inline"
                                                                    value={patientDetails.mutationName || ''}
                                                                    name="mutationName"
                                                                    disabled
                                                                />
                                                            </Form.Group>
                                                        </Col>
                                                        <Col lg="4">
                                                            <Form.Group className="mb-0">
                                                                <Form.Label className="mr-3">Previous Cancer History</Form.Label>
                                                                <Form.Control
                                                                    type="text"
                                                                    className="readOnlyView inline"
                                                                    value={patientDetails.cancerSiteName || ''}
                                                                    name="cancerSiteName"
                                                                    disabled
                                                                />
                                                            </Form.Group>
                                                        </Col>
                                                        <Col lg="4">
                                                            <Form.Group className="mb-0">
                                                                <Form.Label className="mr-3">Doctor Observation</Form.Label>
                                                                <Form.Control
                                                                    type="text"
                                                                    className="readOnlyView inline"
                                                                    value={patientDetails.doctorObservation || ''}
                                                                    name="doctorObservation"
                                                                    disabled
                                                                />
                                                            </Form.Group>
                                                        </Col>
                                                        <div className="w-100 my-3"></div>
                                                        <Col lg="4">
                                                            <Form.Group className="mb-0">
                                                                <Form.Label className="mr-3">Doctor Prescription</Form.Label>
                                                                <Form.Control
                                                                    type="text"
                                                                    className="readOnlyView inline"
                                                                    value={patientDetails.doctorPrescription || ''}
                                                                    name="doctorPrescription"
                                                                    disabled
                                                                />
                                                            </Form.Group>
                                                        </Col>
                                                    </Row>
                                                </Container>
                                            </Card.Body>
                                        </Card>
                                        <Card className="custom-card">
                                            <Card.Header className="fixed-header"><b>Treatment Plan</b></Card.Header>
                                            {/* <Card.Body className="">
                                                <Container fluid className="p-0 mt-4">
                                                    <Row>
                                                        <Col lg="4">
                                                            <Form.Group className="mb-0">
                                                                <Form.Label className="mr-3">Treatment Plan Date</Form.Label>
                                                                <DatePicker value={patientDetails.creationDate ? moment(patientDetails.creationDate) : null} format={dateFormat} disabled className="form-control full-width25" />
                                                            </Form.Group>
                                                        </Col>
                                                        <Col lg="4">
                                                            <Form.Group className="mb-0">
                                                                <Form.Label className="mr-3">Intent</Form.Label>
                                                                <Form.Control
                                                                    type="text"
                                                                    className="readOnlyView inline"
                                                                    value={patientDetails.intent === 'C' ? 'Curative' : patientDetails.intent === 'P' ? 'Palliative' : patientDetails.intent || ''}
                                                                    name="Intent"
                                                                    disabled
                                                                />
                                                            </Form.Group>
                                                        </Col>
                                                        <Col lg="4">
                                                            <Form.Group className="mb-0">
                                                                <Form.Label className="mr-3">Rx Modification Date</Form.Label>
                                                                <DatePicker value={patientDetails.chemoStartDt ? moment(patientDetails.chemoStartDt) : null} format={dateFormat} disabled className="form-control full-width25" />
                                                            </Form.Group>
                                                        </Col>
                                                        <div className="w-100 my-3"></div>
                                                        <Col lg="4">
                        <Form.Group className="mb-0">
                            <Form.Label className="mr-3">Regimen Planned (Protocol Title)</Form.Label>
                            <div className="text-pre-wrap">
                                {patientDetails.protocolName || 'No details available'}
                            </div>
                        </Form.Group>
                    </Col>
                                                        <Col lg="4">
                                                            <Form.Group className="mb-0">
                                                                <Form.Label className="mr-3">Chemotherapy Phase/ Regimen Due</Form.Label>
                                                                <Form.Control
                                                                    type="text"
                                                                    className="readOnlyView inline"
                                                                    value={patientDetails.chemoPhaseRegimen || ''}
                                                                    name="chemoPhaseRegimen"
                                                                    disabled
                                                                />
                                                            </Form.Group>
                                                        </Col>
                                                        <Col lg="4">
                                                            <Form.Group className="mb-0">
                                                                <Form.Label className="mr-3">Schedule for Doctor's Visit</Form.Label>
                                                                <Form.Control
                                                                    type="text"
                                                                    className="readOnlyView inline"
                                                                    value={patientDetails.scheduleName || ''}
                                                                    name="scheduleName"
                                                                    disabled
                                                                />
                                                            </Form.Group>
                                                        </Col>
                                                        <div className="w-100 my-3"></div>
                                                        <Col lg="4">
                                                            <Form.Group className="mb-0">
                                                                <Form.Label className="mr-3">Cycles Planned</Form.Label>
                                                                <Form.Control
                                                                    type="text"
                                                                    className="readOnlyView inline"
                                                                    value={patientDetails.cyclesPlanned || ''}
                                                                    name="cyclesPlanned"
                                                                    disabled
                                                                />
                                                            </Form.Group>
                                                        </Col>
                                                        <Col lg="4">
                                                            <Form.Group className="mb-0">
                                                                <Form.Label className="mr-3">1st Chemo Cycle</Form.Label>
                                                                <DatePicker value={patientDetails.chemoStartDt ? moment(patientDetails.chemoStartDt) : null} format={dateFormat} disabled className="form-control full-width25" />
                                                            </Form.Group>
                                                        </Col>
                                                                    <Col lg="4">
                                                        <Form.Group className="mb-0">
                                                            <Form.Label className="mr-3">Plan of Treatment</Form.Label>
                                                            <div className="text-pre-wrap">
                                                                {patientDetails.treatmentPlan || ''}
                                                            </div>
                                                        </Form.Group>
                                                    </Col>
                                                        <div className="w-100 my-3"></div>
                                                        <Col lg="4">
                                                            <Form.Group className="mb-0">
                                                                <Form.Label className="mr-3">Consent waive Off comment:</Form.Label>
                                                                <Form.Control
                                                                    type="text"
                                                                    className="readOnlyView inline"
                                                                    value={patientDetails.waiveOffConsent || ''}
                                                                    name="waiveOffConsent"
                                                                    disabled
                                                                />
                                                            </Form.Group>
                                                        </Col>
                                                        <Col lg="4">
                                                            <Form.Group className="mb-0">
                                                                <Form.Label className="mr-3">Dosage Frequency</Form.Label>
                                                                <Form.Control
                                                                    type="text"
                                                                    className="readOnlyView inline"
                                                                    value={patientDetails.scheduleName || ''}
                                                                    name="scheduleName"
                                                                    disabled
                                                                />
                                                            </Form.Group>
                                                        </Col>
                                                    </Row>
                                                </Container>
                                            </Card.Body> */}


                                        </Card>
                                        <Card className="custom-card">
                                            <Card.Header className="fixed-header"><b>Treatment Plans</b></Card.Header>
                                            <Card.Body className="">
                                                <Container fluid className="p-0 mt-4">
                                                    <Row>
                                                        {allTreatmentPlans.map((treatment, idx) => (
                                                            <Col lg="6" key={idx} className="mb-4">
                                                                <Card className="custom-card">
                                                                    <Card.Header className="fixed-header"><b>Treatment Plan {idx + 1}</b></Card.Header>
                                                                    <Card.Body className="">
                                                                        <div className="product-details pl-3 ml-3">
                                                                            <p><label>Regimen Planned:</label> {treatment.protocolMstDTO.protocolName}</p>
                                                                            <p><label>Cycles Planned:</label> {treatment.cyclesPlanned}</p>
                                                                            <p><label>Schedule for Doctor's Visit:</label> {treatment.scheduleMstDTO.scheduleName}</p>
                                                                            <p><label>Chemo Date:</label> {this.formatDateMMDDYY(treatment.chemoStartDt)}</p>
                                                                        </div>
                                                                        <div className="mt-3">
                                                                            <Button variant="info" onClick={() => this.handleViewTreatment(treatment.patientTreatmentPlanId)}>View Treatment</Button>
                                                                        </div>
                                                                    </Card.Body>
                                                                </Card>
                                                            </Col>
                                                        ))}
                                                    </Row>
                                                </Container>
                                            </Card.Body>
                                        </Card>

                                        <Modal show={showTreatmentModal} onHide={this.closeTreatmentModal} centered>
                                            <Modal.Header closeButton>
                                                <Modal.Title>Treatment Plan Details</Modal.Title>
                                            </Modal.Header>
                                            <Modal.Body>
                                                {this.renderTreatmentDetails()}
                                            </Modal.Body>
                                        </Modal>
                                        <Card className="custom-card">
                                            <Card.Header className="fixed-header"><b>Active Treatments</b></Card.Header>
                                            <Card.Body className="">
                                                <Container fluid className="p-0 mt-4">
                                                    <Row>
                                                        {activeTreatmentPlans.map((d, idx) => (
                                                            <Col lg="6" key={idx} className="mb-4">
                                                                <Card className="custom-card">
                                                                    <Card.Header className="fixed-header"><b>Active Treatment Plan</b></Card.Header>
                                                                    <Card.Body className="">
                                                                        <div className="product-details pl-3 ml-3">
                                                                            <p><label>Regimen Planned:</label> {d.protocolMstDTO.protocolName}</p>
                                                                            <p><label>Cycles Planned:</label> {d.cyclesPlanned}</p>
                                                                            <p><label>Schedule for Doctor's Visit:</label> {d.scheduleMstDTO.scheduleName}</p>
                                                                            <p><label>Chemo Date:</label> {this.formatDateMMDDYY(d.chemoStartDt)}</p>
                                                                        </div>
                                                                        <div className="mt-3">
                                                                            <h5>Chemotherapy Schedule</h5>
                                                                            {this.renderGeneratedSchedule(d.patientTreatmentPlanId, this.state.generatedSchedules)}
                                                                        </div>
                                                                    </Card.Body>
                                                                </Card>
                                                            </Col>
                                                        ))}
                                                    </Row>
                                                </Container>
                                            </Card.Body>
                                        </Card>
                                        <Card className="custom-card">
                                            <Card.Header className="fixed-header"><b>Inactive Treatments</b></Card.Header>
                                            <Card.Body className="">
                                                <Container fluid className="p-0 mt-4">
                                                    <Row>
                                                        {inactiveTreatmentPlans.map((d, idx) => (
                                                            <Col lg="6" key={idx} className="mb-4">
                                                                <Card className="custom-card">
                                                                    <Card.Header className="fixed-header"><b>Inactive Treatment Plan</b></Card.Header>
                                                                    <Card.Body className="">
                                                                        <div className="product-details pl-3 ml-3">
                                                                            <p><label>Regimen Planned:</label> {d.protocolMstDTO.protocolName}</p>
                                                                            <p><label>Cycles Planned:</label> {d.cyclesPlanned}</p>
                                                                            <p><label>Schedule for Doctor's Visit:</label> {d.scheduleMstDTO.scheduleName}</p>
                                                                            <p><label>Chemo Date:</label> {this.formatDateMMDDYY(d.chemoStartDt)}</p>
                                                                        </div>
                                                                        <div className="mt-3">
                                                                            <h5>Chemotherapy Schedule</h5>
                                                                            {this.renderGeneratedSchedule(d.patientTreatmentPlanId, this.state.inactiveSchedules)}
                                                                        </div>
                                                                    </Card.Body>
                                                                </Card>
                                                            </Col>
                                                        ))}
                                                    </Row>
                                                </Container>
                                            </Card.Body>
                                        </Card>
                                        <Card className="custom-card">
                                            <Card.Header className="fixed-header"><b>Follow-Up Appointment Dates</b></Card.Header>
                                            <Row className="ml-4 mb-3">
                                                <Col lg="3">
                                                    <Form.Group className="mb-0">
                                                        <Form.Label className="mr-3"><strong>Follow-Up Date</strong></Form.Label>
                                                        {patientDetails.chemoDt ? (
                                                            <DatePicker 
                                                                value={moment(patientDetails.appointmentDt)} 
                                                                format={dateFormat} 
                                                                disabled={true} 
                                                                className="form-control full-width25" 
                                                            />
                                                        ) : (
                                                            <Form.Control 
                                                                type="text" 
                                                                value="Date not available" 
                                                                disabled={true} 
                                                                className="form-control full-width25" 
                                                            />
                                                        )}
                                                    </Form.Group>
                                                </Col>
                                                <Col lg="3">
                                                    <Form.Group className="mb-0">
                                                        <Form.Label className="mr-3"><strong>Weight</strong></Form.Label>
                                                        <Form.Control
                                                            type="text"
                                                            className="readOnlyView inline"
                                                            value={`${patientDetails.faWeight || ''} kg`}
                                                            name="faWeight"
                                                            disabled
                                                        />
                                                    </Form.Group>
                                                </Col>
                                                <Col lg="6">
                                                    <Form.Group className="mb-0">
                                                        <Form.Label className="mr-3"><strong>Adverse Effects</strong></Form.Label>
                                                        <div>{this.renderAdverseEffects()}</div>
                                                    </Form.Group>
                                                </Col>
                                            </Row>

                                            <Row className="ml-4 mb-3">
                                                <Col lg="6">
                                                    <div className="mb-2">
                                                        <strong>Doctor Observation:</strong>
                                                    </div>
                                                    <div className="text-pre-wrap">
                                                        {doctorObservation}
                                                    </div>
                                                </Col>
                                                <Col lg="6">
                                                    <div className="mb-2">
                                                        <strong>Doctor Prescription:</strong>
                                                    </div>
                                                    <div className="text-pre-wrap">
                                                        {doctorPrescription}
                                                    </div>
                                                </Col>
                                            </Row>
                                            <Card.Body>
                                                <Container fluid className="p-0 mt-4">
                                                    {followUpAppointments && followUpAppointments.map(appointment => (
                                                        <React.Fragment key={appointment.appointmentId}>
                                                            <Row className="ml-3.8 mb-3">
                                                                <Col lg="3">
                                                                    <Form.Group className="mb-0">
                                                                        <Form.Label><strong>Appointment Date</strong></Form.Label>
                                                                        <Form.Control
                                                                            type="text"
                                                                            className="readOnlyView inline"
                                                                            value={moment(appointment.appointmentDt).format('DD-MM-YYYY')}
                                                                            disabled
                                                                        />
                                                                    </Form.Group>
                                                                </Col>
                                                                <Col lg="3">
                                                                    <Form.Group className="mb-0">
                                                                        <Form.Label><strong>Weight</strong></Form.Label>
                                                                        <Form.Control
                                                                            type="text"
                                                                            className="readOnlyView inline"
                                                                            value={`${appointment.weight || ''} ${appointment.weightUnitDto ? appointment.weightUnitDto.unitName : ''}`}
                                                                            disabled
                                                                        />
                                                                    </Form.Group>
                                                                </Col>
                                                                <Col lg="6">
                                                                    <Form.Group className="mb-0">
                                                                        <Form.Label><strong>Adverse Effects</strong></Form.Label>
                                                                        <div className="text-pre-wrap">
                                                                            {appointment.adverseEffects || 'No details available'}
                                                                        </div>
                                                                    </Form.Group>
                                                                </Col>
                                                            </Row>

                                                            <Row className="ml-3 mb-3">
                                                                <Col lg="6">
                                                                    <div className="mb-2">
                                                                        <strong>Doctor Observation:</strong>
                                                                    </div>
                                                                    <div className="text-pre-wrap">
                                                                        {appointment.doctorObservation || 'No details available'}
                                                                    </div>
                                                                </Col>
                                                                <Col lg="6">
                                                                    <div className="mb-2">
                                                                        <strong>Doctor Prescription:</strong>
                                                                    </div>
                                                                    <div className="text-pre-wrap">
                                                                        {appointment.doctorPrescription || 'No details available'}
                                                                    </div>
                                                                </Col>
                                                            </Row>
                                                            <div className="dropdown-divider pb-2"></div>
                                                        </React.Fragment>
                                                    ))}
                                                </Container>
                                            </Card.Body>
                                        </Card>

                                        <Card className="custom-card">
                                            <Card.Header className="fixed-header"><b>Previous Chemo Sitting</b></Card.Header>
                                            <Card.Body className="">
                                                <Container fluid className="p-0 mt-4">
                                                    <Row>
                                                        <Col lg='4'>
                                                            <Form.Group>
                                                                <Form.Label>Date</Form.Label>
                                                                <DatePicker value={patientDetails.chemoDt ? moment(patientDetails.chemoDt) : ''} format={dateFormat} disabled={true} className="form-control full-width25" />
                                                            </Form.Group>
                                                        </Col>
                                                        <Col lg='4'>
                                                            <Form.Group className="mb-0">
                                                                <Form.Label className="mr-3">Chemo Dosage Prescription</Form.Label>
                                                                <Form.Control
                                                                    type="text"
                                                                    className="readOnlyView inline"
                                                                    value={patientDetails.treatmentGiven || ''}
                                                                    name="treatmentGiven"
                                                                    disabled
                                                                />
                                                            </Form.Group>
                                                        </Col>
                                                        <Col lg='4'>
                                                            <Form.Group className="mb-0">
                                                                <Form.Label className="mr-3">Antiemetic Medication</Form.Label>
                                                                <Form.Control
                                                                    type="text"
                                                                    className="readOnlyView inline"
                                                                    value={patientDetails.antiemeticDrugs || ''}
                                                                    name="antiemeticDrugs"
                                                                    disabled
                                                                />
                                                            </Form.Group>
                                                        </Col>
                                                    </Row>
                                                    <div className="dropdown-divider pb-2"></div>
                                                    <Row>
                                                        {this.renderChemoDetails()}
                                                    </Row>
                                                </Container>
                                            </Card.Body>
                                        </Card>
                                    </div>
                                </section>
                            </div>
                        </Container>
                    </div>
                </div>
                <Loader show={loaderModal} />
            </div>
        );
    }
}

export default AnalyticsReport;
