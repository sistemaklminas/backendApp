// Em: src/lib/formatters.ts

/**
 * Formata um número como moeda brasileira (BRL).
 * @param value O número a ser formatado.
 * @returns A string formatada, ex: "R$ 1.234,56".
 */
export function formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
}

export function formatTime(timeString: string): string {
    if (!timeString || !timeString.includes(':')) {
        return timeString; // Retorna o original se o formato for inesperado
    }
    const [hours, minutes] = timeString.split(':');
    return `${hours}h${minutes}min`;
}

const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function formatWeekdays(dayIndexes: number[]): string {
    if (!dayIndexes || dayIndexes.length === 0) {
        return 'Nenhum dia selecionado';
    }
    // Ordena os índices para garantir a ordem (Seg, Ter, Qua...)
    const sortedIndexes = [...dayIndexes].sort((a, b) => a - b);
    return sortedIndexes.map(index => dayNames[index]).join(' - ');
}

// TEST VALID CPF (BRAZILIAN DOCUMENT) FUNCTION
export function testaCPF(cpfNumber: string) {
    // Remove pontos e hífens
    cpfNumber = cpfNumber.replace(/[^\d]/g, "");

    let Soma;
    let Resto;
    Soma = 0;
    if (cpfNumber == "00000000000") return false;

    for (let i = 1; i <= 9; i++)
        Soma = Soma + parseInt(cpfNumber.substring(i - 1, i)) * (11 - i);
    Resto = (Soma * 10) % 11;

    if (Resto == 10 || Resto == 11) Resto = 0;
    if (Resto != parseInt(cpfNumber.substring(9, 10))) return false;

    Soma = 0;
    for (let i = 1; i <= 10; i++)
        Soma = Soma + parseInt(cpfNumber.substring(i - 1, i)) * (12 - i);
    Resto = (Soma * 10) % 11;

    if (Resto == 10 || Resto == 11) Resto = 0;
    if (Resto != parseInt(cpfNumber.substring(10, 11))) return false;
    return true;
}

export const formataCPF = (cpfNumber: string) => {
    cpfNumber = cpfNumber.replace(/[^\d]/g, ""); // Remove tudo que não for número

    // Limita a quantidade de caracteres no CPF
    if (cpfNumber.length > 11) {
        cpfNumber = cpfNumber.substring(0, 11);
    }

    // Formatação progressiva conforme o número de caracteres
    if (cpfNumber.length <= 3) {
        cpfNumber = cpfNumber.replace(/(\d{1,3})/, "$1"); // Exibe os 3 primeiros números
    } else if (cpfNumber.length <= 6) {
        cpfNumber = cpfNumber.replace(/(\d{3})(\d{1,3})/, "$1.$2"); // Adiciona o primeiro ponto após 3 caracteres
    } else if (cpfNumber.length <= 9) {
        cpfNumber = cpfNumber.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3"); // Adiciona o segundo ponto após 6 caracteres
    } else {
        cpfNumber = cpfNumber.replace(
            /(\d{3})(\d{3})(\d{3})(\d{1,2})/,
            "$1.$2.$3-$4"
        ); // Adiciona o hífen após 9 caracteres
    }

    return cpfNumber; // Retorna o CPF formatado
};

/**
 * Recebe um objeto Date e retorna uma string no formato YYYY-MM-DD.
 * Ideal para salvar em bancos de dados ou usar em IDs.
 * @param date O objeto Date a ser formatado.
 * @returns A data formatada como string 'YYYY-MM-DD'.
 */
export function getFormattedDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0'); // getMonth() é 0-indexed
    const day = date.getDate().toString().padStart(2, '0');

    return `${year}-${month}-${day}`;
}

/**
 * Formata um objeto Date para o padrão brasileiro (dd/mm/yyyy).
 */
export function toLocaleDateString(date: Date): string {
    if (!date || !(date instanceof Date)) return 'N/A';
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}


// Função helper para formatar o telefone
export function formatPhoneNumber(phone: string) {
    if (!phone || phone.length < 14) return phone;
    const ddd = phone.substring(3, 5);
    const part1 = phone.substring(5, 10);
    const part2 = phone.substring(10, 14);
    return `(${ddd}) ${part1}-${part2}`;
}