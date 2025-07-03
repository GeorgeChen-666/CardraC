import { createTheme } from '@mui/material/styles';

const mainColor = {
  color: '#F7F7F7',
  backgroundColor: '#2B2D30',
}
const borderColor = '#43454A'
const mainBorder = {
  border: '1px solid ' + borderColor,
  borderRadius: '0'
}

export const defaultTheme = createTheme({
  components: {
    MuiDialog: {
      styleOverrides: {
        paper: {
          ...mainColor,
          ...mainBorder
        }
      }
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          padding: '4px 10px',
          fontSize: '1rem',
          fontWeight: 'normal',
          borderBottom: mainBorder.border,
        }
      }
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          paddingTop: '20px!important'
        }
      }
    },
    MuiDialogContentText: {
      styleOverrides: {
        root: mainColor,
      }
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          ...mainColor,
          ...mainBorder
        }
      }
    },
    MuiInputLabel:{
      styleOverrides: {
        root: {
          ...mainColor,
          '&.Mui-disabled': {
            color: '#999',
            WebkitTextFillColor: '#999',
          },
        }
      }
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          marginRight: '10px',
        }
      }
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          '& .MuiSvgIcon-root': {
            color: borderColor,
          }
        }
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-notchedOutline legend': {
            maxWidth: '0'
          },
          '&:hover:not(.Mui-disabled) .MuiOutlinedInput-notchedOutline': {
            borderColor: '#fff',
          },
          '.MuiSvgIcon-root': {
            color: borderColor,
          },
          '&.Mui-disabled .MuiSvgIcon-root': {
            color: '#323337'
          }
        },
        input: {
          // padding: '4px 12px',
          ...mainColor,
          ...mainBorder,
          borderRadius: '4px',
          '&[type=number]': {
            paddingRight: '5px',
          },
          '&[type=number]::-webkit-inner-spin-button, &[type=number]::-webkit-outer-spin-button': {
            marginTop: '-5px',
            marginBottom: '-5px',
          },
          '&.Mui-disabled': {
            color: '#999',
            WebkitTextFillColor: '#999',
          },
        },
        notchedOutline: {
          borderColor: 'transparent',
        },
      }
    },
    MuiTab: {
      styleOverrides: {
        textColorPrimary: mainColor
      }
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: '6px',
          padding: 8,
          minWidth: '40px',
          minHeight: '40px',
          transition: 'all 0.2s ease',
          '&.MuiIconButton-sizeSmall': {
            padding: 4,
            minWidth: '32px',
            minHeight: '32px'
          },
          '&.MuiIconButton-sizeLarge': {
            padding: 12,
            minWidth: '48px',
            minHeight: '48px'
          },
          '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.08)',
            transform: 'scale(1.05)'
          }
        }
      }
    }
  }
});