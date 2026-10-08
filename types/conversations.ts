export interface Message {
    role: string;
    content: string;
    annotations?: Annotation[]
    comments?: Comment[]
  }

export interface Comment {
  _id: string;
  name: string;
  timestamp: number;
  content: string;
}

export interface Answer {
  _id: string;
  name: string;
  timestamp: number;
  content: string[] | null;
}
  
export interface Annotation {
  _id: string;
  title: string;
  type: string;
  options?: string[];
  answers: Answer[];
}
  
export interface Conversation {
  _id: string;
  title: string;
  stime: {
    text: string;
    timestamp: number;
  };
  messages: Message[];
  annotations?: Annotation[];
  last_interact: {
    text: string;
    timestamp: number;
  };
  person?: string;
  Person?: string;
  annotationStats?: AnnotationStats;
}

export interface User {
  _id: string;
  username: string;
  role: string;
  assignedConversations?: {
    [databaseId: string]: {
      assignments: {
        assignmentTitle: string;
        conversations: string[];
      }[];
    };
  };
  isDeleted: boolean;
}

export interface Database {
  _id: string;
  uri: string;
  databaseId: string;
  containerId: string;
  name: string;
}

export interface AnnotationStats {
  annotated: number;
  inProgress: number;
  notAnnotated: number;
  totalAssigned: number;
  annotatedUsers: string[];
  inProgressUsers: string[];
  notAnnotatedUsers: string[];
}