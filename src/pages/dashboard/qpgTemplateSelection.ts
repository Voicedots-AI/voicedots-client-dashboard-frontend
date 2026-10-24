import type {PaperTemplate} from './QpgTemplatesPanel';

export function matchingInstitutionTemplate(items:PaperTemplate[],institutionName:string){
 const institution=institutionName.trim().toLowerCase();
 const matching=institution?items.filter(item=>item.status==='ACTIVE'&&item.configuration.institution_name?.trim().toLowerCase()===institution):[];
 return matching.find(item=>item.configuration.layout_style==='UNIVERSITY')||matching[0];
}
