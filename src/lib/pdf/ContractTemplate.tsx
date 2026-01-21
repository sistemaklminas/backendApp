// Em: src/features/contracts/ContractTemplate.tsx

import { useYearContext } from '../../contexts/YearContext';
import type { ContractSessionData } from './api';
import { ConsolidatedValuesTable } from './ConsolidatedValuesTable';
import { getContractContent, type ParagraphChild } from './contractContent';

interface ContractTemplateProps {
  data: ContractSessionData;
}

// Componente auxiliar para renderizar um parágrafo
const Paragraph = ({ children }: { children: ParagraphChild[] }) => (
  <p className="avoid-page-break">
    {children.map((child, index) => {
      if (typeof child === 'string') {
        return <span key={index}>{child}</span>;
      }
      if (child.style === 'bold') {
        return <strong key={index}>{child.text}</strong>;
      }
      if (child.style === 'underline') {
        return (
          <span
            key={index}
            style={{ textDecoration: 'underline' }}
          >
            {child.text}
          </span>
        );
      }
      return null;
    })}
  </p>
);

export function ContractTemplate({ data }: ContractTemplateProps) {
  const { viewingYear } = useYearContext();
  const content = getContractContent(data, viewingYear);
  const { financialResponsible: resp } = data;

  return (
    // O ID 'contract-content' será útil para a geração do PDF depois
    <div
      id="contract-content"
      className="p-8 sm:p-12 rounded-lg shadow-lg text-justify text-sm leading-relaxed"
      style={{ backgroundColor: '#ffffff', color: '#18181b' }}
    >
      {content.map((block, index) => {
        switch (block.type) {
          case 'h1':
            return (
              <h1
                key={index}
                className="text-center font-bold text-lg mb-4"
              >
                {block.text}
              </h1>
            );
          case 'h2':
            return (
              <h2
                key={index}
                className="text-center font-bold text-md mb-8"
              >
                {block.text}
              </h2>
            );
          case 'h3':
            return (
              <h3
                key={index}
                className="font-bold mt-6 mb-2"
              >
                {block.text}
              </h3>
            );
          // case 'h4':
          //   return (
          //     <h4
          //       key={index}
          //       className="font-semibold text-center mt-4"
          //     >
          //       {block.text}
          //     </h4>
          //   );
          case 'p':
            return <Paragraph key={index}>{block.children}</Paragraph>;
          case 'table':
            return (
              <ConsolidatedValuesTable
                key={index}
                data={data}
              />
            );
          case 'date':
            return (
              <div
                key={index}
                className="mt-16 text-center"
              >
                <p>
                  Belo Horizonte,{' '}
                  {new Date().toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                  .
                </p>
              </div>
            );
          case 'signatures':
            return (
              <div
                key={index}
                className="mt-16 pt-8 grid grid-cols-1 sm:grid-cols-2 gap-8 text-center"
              >
                <div id="contratante-signature-area">
                  <div
                    className="w-64 mx-auto pt-2"
                    style={{ borderTop: '2px solid #a1a1aa' }}
                  >
                    <p className="font-bold">{resp.name.toLocaleUpperCase()}</p>
                    <p>Contratante (CPF: {resp.document})</p>
                  </div>
                </div>
                <div>
                  <div
                    className="w-64 mx-auto pt-2"
                    style={{ borderTop: '2px solid #a1a1aa' }}
                  >
                    <p className="font-bold">KL Minas Esportes LTDA</p>
                    <p>Contratada (CNPJ 13.839.322/0001-70)</p>
                  </div>
                </div>
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
