import { Router } from "express";
import { getAdmins } from "../controllers";
import { auth } from "../middlewares/auth";
import { adminLogin, getRequests, updateGroup, groupInfo, getAllMaterias, getMateria, getGroupsAdmin } from "../controllers/admin.controller";



const adminRouter = Router();

adminRouter.get('/', auth, getAdmins);
adminRouter.get('/groups', auth, getGroupsAdmin);
adminRouter.post('/groups', auth, getGroupsAdmin);
adminRouter.get('/groups/:id', groupInfo);
adminRouter.patch('/groups/:id', updateGroup);
adminRouter.post('/login', adminLogin);
adminRouter.get('/grupos/:id/solicitudes', getRequests);
adminRouter.get('/materias/:id', getMateria);
adminRouter.get('/materias', auth, getAllMaterias);


export default adminRouter;