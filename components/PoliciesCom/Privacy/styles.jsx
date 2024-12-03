import { StyleSheet,} from 'react-native';

const styles = StyleSheet.create({
    container:{
        flex:1,
        marginTop:30,
        marginHorizontal:10,
        marginBottom:20,
    },
    header:{
        fontSize:30,
        fontWeight:'bold',
        textAlign:'center'
    },
    subHeader:{
        marginTop:15,
        fontSize:19,
        fontWeight:'bold',
    },

    txtSub:{
        marginTop:10,
        fontSize:17,
        lineHeight:20,
    },
    txt:{
        fontSize:17,
        lineHeight:20,
    },
    
    pointer:{
        fontWeight:'bold',
    },
    supportConEmail:{
        flexDirection:'row',
        alignItems:'center',
        gap:10,
    },
    emailIcon:{
        fontSize:20,
        color:'black',
    },
    supportEmail:{
        fontSize:17,
        fontStyle:'italic',
        fontWeight:'bold',
        color:'#1743d3'
    },
    supportConPhone:{
        marginTop:10,
        flexDirection:'row',
        alignItems:'center',
        gap:10,
    },
    phoneIcon:{
        fontSize:20,
        color:"black",
    },
    supportPhone:{
        fontSize:17,
        fontStyle:'italic',
        fontWeight:'bold',
        color:'#02091f'
    }
})

export default styles;
